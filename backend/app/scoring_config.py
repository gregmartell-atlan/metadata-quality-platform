"""
Scoring Configuration Loader

Loads scoring weights from the shared config/scoring-weights.yaml file
to ensure consistency between frontend and backend implementations.
"""

import os
import yaml
import logging
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class DimensionWeights(BaseModel):
    """Overall quality dimension weights."""
    completeness: float = 0.30
    accuracy: float = 0.25
    timeliness: float = 0.20
    consistency: float = 0.15
    usability: float = 0.10


class TimelinessConfig(BaseModel):
    """Timeliness scoring configuration."""
    mode: str = "bands"
    bands: Dict[str, int] = Field(default_factory=lambda: {
        "fresh": 7,
        "recent": 30,
        "aging": 90,
        "stale": 180
    })
    decay: Dict[str, int] = Field(default_factory=lambda: {
        "tau_metadata_days": 60,
        "tau_source_days": 90,
        "tau_usage_days": 30,
        "tau_certification_days": 90
    })


class QualityBands(BaseModel):
    """Quality band thresholds."""
    excellent: int = 80
    good: int = 60
    fair: int = 40
    poor: int = 20


class LineageConfig(BaseModel):
    """Lineage metrics configuration."""
    full_lineage_bonus: int = 10
    orphaned_penalty: int = 0
    max_upstream_depth: int = 5
    max_downstream_depth: int = 5


class ScoringConfig(BaseModel):
    """Complete scoring configuration."""
    version: str = "2.0"
    dimension_weights: DimensionWeights = Field(default_factory=DimensionWeights)
    timeliness: TimelinessConfig = Field(default_factory=TimelinessConfig)
    bands: QualityBands = Field(default_factory=QualityBands)
    lineage: LineageConfig = Field(default_factory=LineageConfig)
    active_profile: str = "default"
    profiles: Dict[str, Dict[str, DimensionWeights]] = Field(default_factory=dict)

    def get_weights_for_profile(self, profile: Optional[str] = None) -> DimensionWeights:
        """Get dimension weights for a specific profile or the active profile."""
        profile_name = profile or self.active_profile
        if profile_name in self.profiles:
            profile_data = self.profiles[profile_name]
            if "dimension_weights" in profile_data:
                return DimensionWeights(**profile_data["dimension_weights"])
        return self.dimension_weights

    def get_overall_score(
        self,
        completeness: float,
        accuracy: float,
        timeliness: float,
        consistency: float,
        usability: float,
        profile: Optional[str] = None
    ) -> float:
        """Calculate overall score using configured weights."""
        weights = self.get_weights_for_profile(profile)
        return (
            weights.completeness * completeness +
            weights.accuracy * accuracy +
            weights.timeliness * timeliness +
            weights.consistency * consistency +
            weights.usability * usability
        )


def find_config_file() -> Optional[Path]:
    """Find the scoring-weights.yaml config file."""
    # Try multiple possible locations
    possible_paths = [
        # Relative to project root
        Path(__file__).parent.parent.parent / "config" / "scoring-weights.yaml",
        # From cwd
        Path.cwd() / "config" / "scoring-weights.yaml",
        # From environment variable
        Path(os.environ.get("SCORING_CONFIG_PATH", "")) if os.environ.get("SCORING_CONFIG_PATH") else None,
    ]

    for path in possible_paths:
        if path and path.exists():
            return path

    return None


@lru_cache()
def load_scoring_config() -> ScoringConfig:
    """
    Load scoring configuration from YAML file.
    Falls back to defaults if file not found.
    """
    config_path = find_config_file()

    if config_path is None:
        logger.warning("scoring-weights.yaml not found, using defaults")
        return ScoringConfig()

    try:
        with open(config_path, "r") as f:
            raw_config = yaml.safe_load(f)

        logger.info(f"Loaded scoring config from {config_path}")

        # Parse into structured config
        config = ScoringConfig(
            version=raw_config.get("version", "2.0"),
            dimension_weights=DimensionWeights(**raw_config.get("dimension_weights", {})),
            timeliness=TimelinessConfig(
                mode=raw_config.get("timeliness", {}).get("mode", "bands"),
                bands=raw_config.get("timeliness", {}).get("bands", {}),
                decay=raw_config.get("timeliness", {}).get("decay", {})
            ),
            bands=QualityBands(**raw_config.get("bands", {})),
            lineage=LineageConfig(**raw_config.get("lineage", {})),
            profiles=raw_config.get("profiles", {})
        )

        return config

    except Exception as e:
        logger.error(f"Error loading scoring config: {e}, using defaults")
        return ScoringConfig()


def get_scoring_config() -> ScoringConfig:
    """Get the cached scoring configuration."""
    return load_scoring_config()


# Export convenience function for SQL template generation
def get_overall_score_sql(
    completeness_col: str = "completeness_score",
    accuracy_col: str = "accuracy_score",
    timeliness_col: str = "timeliness_score",
    consistency_col: str = "consistency_score",
    usability_col: str = "usability_score",
    profile: Optional[str] = None
) -> str:
    """
    Generate SQL expression for calculating overall score.
    Uses weights from configuration.
    """
    config = get_scoring_config()
    weights = config.get_weights_for_profile(profile)

    return f"""(
        {weights.completeness} * {completeness_col} +
        {weights.accuracy} * {accuracy_col} +
        {weights.timeliness} * {timeliness_col} +
        {weights.consistency} * {consistency_col} +
        {weights.usability} * {usability_col}
    )"""


def get_timeliness_sql_bands(
    updated_at_col: str = "A.UPDATED_AT",
    source_updated_col: str = "A.SOURCE_UPDATED_AT",
    cert_updated_col: str = "A.CERTIFICATE_UPDATED_AT"
) -> str:
    """
    Generate SQL expression for band-based timeliness scoring.
    """
    config = get_scoring_config()
    bands = config.timeliness.bands

    return f"""CASE
        WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE({updated_at_col}, 0)/1000), CURRENT_TIMESTAMP()) <= {bands['fresh']} THEN 100
        WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE({updated_at_col}, 0)/1000), CURRENT_TIMESTAMP()) <= {bands['recent']} THEN 75
        WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE({updated_at_col}, 0)/1000), CURRENT_TIMESTAMP()) <= {bands['aging']} THEN 50
        WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE({updated_at_col}, 0)/1000), CURRENT_TIMESTAMP()) <= {bands['stale']} THEN 25
        ELSE 0
    END"""
