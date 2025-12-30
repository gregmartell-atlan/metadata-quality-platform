import type { ScoringProfile, ProfileScoreResult, AtlanAsset, ScoringContext } from "./contracts";
import { Industry5DProfile } from "./profiles/industry5d";
import { StandardCompletenessProfile } from "./profiles/standardCompleteness";

export class ScoringEngine {
  private profiles: Record<string, ScoringProfile>;

  constructor() {
    this.profiles = {
      industry5d: new Industry5DProfile(),
      standardCompleteness: new StandardCompletenessProfile()
    };
  }

  scoreAll(asset: AtlanAsset, ctx: ScoringContext): ProfileScoreResult[] {
    const active: string[] = ctx.config.activeProfiles ?? ["industry5d"];
    return active.map(id => this.profiles[id].score(asset, ctx));
  }
}

