import { PivotSection } from './PivotSection';
import { PivotTable } from './PivotTable';
import { getScoreClass, getHeatClass } from '../../utils/scoreThresholds';
import './DemoPivots.css';

export function DemoPivots() {
  return (
    <div className="demo-pivots">
      {/* Pivot 1: Connection × Asset Type × Completeness */}
      <PivotSection
        title="Completeness by Connection & Asset Type"
        subtitle="Which source systems and asset types need the most documentation work?"
        meta={[
          { label: '📊', value: '3,847 assets' },
          { label: '🕐', value: 'Updated 5m ago' },
        ]}
        rows={
          <>
            <span className="chip">
              <span className="chip-icon">🔗</span> Connection
            </span>
            <span className="chip">
              <span className="chip-icon">📦</span> Asset Type
            </span>
          </>
        }
        measures={
          <>
            <span className="chip"># Assets</span>
            <span className="chip">% with Description</span>
            <span className="chip">% with Owner</span>
            <span className="chip">Avg Completeness</span>
          </>
        }
        insights={[
          {
            type: 'danger',
            message: '<strong>PostgreSQL Legacy</strong> has 567 assets at 31% completeness — prioritize for Q1 cleanup',
          },
          {
            type: 'success',
            message: '<strong>Tableau</strong> leads at 86% — replicate their documentation practices',
          },
        ]}
      >
        <PivotTable
          headers={['Connection / Asset Type', 'Assets', '% Described', '% Owned', 'Completeness', 'Distribution']}
          rows={[
            [
              <span key="sf">
                <span className="dim-icon connection">❄️</span>Snowflake Production
              </span>,
              <strong key="sf-num">1,245</strong>,
              '78%',
              '82%',
              <div key="sf-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill good" style={{ width: '74%' }}></div>
                </div>
                <span className="bar-value">74</span>
              </div>,
              <div key="sf-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '4px' }}></div>
                <div className="count-bar poor" style={{ height: '8px' }}></div>
                <div className="count-bar fair" style={{ height: '14px' }}></div>
                <div className="count-bar good" style={{ height: '20px' }}></div>
                <div className="count-bar excellent" style={{ height: '24px' }}></div>
              </div>,
            ],
            [
              <span key="sf-table" className="dim-cell indent-1">
                ├─ Table
              </span>,
              '523',
              '85%',
              '89%',
              <div key="sf-table-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '82%' }}></div>
                </div>
                <span className="bar-value">82</span>
              </div>,
              <div key="sf-table-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '2px' }}></div>
                <div className="count-bar poor" style={{ height: '4px' }}></div>
                <div className="count-bar fair" style={{ height: '8px' }}></div>
                <div className="count-bar good" style={{ height: '16px' }}></div>
                <div className="count-bar excellent" style={{ height: '24px' }}></div>
              </div>,
            ],
            [
              <span key="sf-view" className="dim-cell indent-1">
                ├─ View
              </span>,
              '312',
              '72%',
              '78%',
              <div key="sf-view-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill good" style={{ width: '68%' }}></div>
                </div>
                <span className="bar-value">68</span>
              </div>,
              <div key="sf-view-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '4px' }}></div>
                <div className="count-bar poor" style={{ height: '10px' }}></div>
                <div className="count-bar fair" style={{ height: '16px' }}></div>
                <div className="count-bar good" style={{ height: '20px' }}></div>
                <div className="count-bar excellent" style={{ height: '12px' }}></div>
              </div>,
            ],
            [
              <span key="sf-col" className="dim-cell indent-1">
                └─ Column
              </span>,
              '410',
              '68%',
              '74%',
              <div key="sf-col-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill good" style={{ width: '65%' }}></div>
                </div>
                <span className="bar-value">65</span>
              </div>,
              <div key="sf-col-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '6px' }}></div>
                <div className="count-bar poor" style={{ height: '12px' }}></div>
                <div className="count-bar fair" style={{ height: '18px' }}></div>
                <div className="count-bar good" style={{ height: '14px' }}></div>
                <div className="count-bar excellent" style={{ height: '8px' }}></div>
              </div>,
            ],
            [
              <span key="bq">
                <span className="dim-icon connection">🔷</span>BigQuery Analytics
              </span>,
              <strong key="bq-num">892</strong>,
              '62%',
              '71%',
              <div key="bq-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill fair" style={{ width: '58%' }}></div>
                </div>
                <span className="bar-value">58</span>
              </div>,
              <div key="bq-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '8px' }}></div>
                <div className="count-bar poor" style={{ height: '14px' }}></div>
                <div className="count-bar fair" style={{ height: '20px' }}></div>
                <div className="count-bar good" style={{ height: '16px' }}></div>
                <div className="count-bar excellent" style={{ height: '10px' }}></div>
              </div>,
            ],
            [
              <span key="pg">
                <span className="dim-icon connection">🐘</span>PostgreSQL Legacy
              </span>,
              <strong key="pg-num">567</strong>,
              '34%',
              '42%',
              <div key="pg-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill poor" style={{ width: '31%' }}></div>
                </div>
                <span className="bar-value">31</span>
              </div>,
              <div key="pg-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '20px' }}></div>
                <div className="count-bar poor" style={{ height: '24px' }}></div>
                <div className="count-bar fair" style={{ height: '14px' }}></div>
                <div className="count-bar good" style={{ height: '6px' }}></div>
                <div className="count-bar excellent" style={{ height: '2px' }}></div>
              </div>,
            ],
            [
              <span key="tb">
                <span className="dim-icon connection">📊</span>Tableau Workbooks
              </span>,
              <strong key="tb-num">1,143</strong>,
              '89%',
              '94%',
              <div key="tb-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '86%' }}></div>
                </div>
                <span className="bar-value">86</span>
              </div>,
              <div key="tb-dist" className="count-dist">
                <div className="count-bar critical" style={{ height: '2px' }}></div>
                <div className="count-bar poor" style={{ height: '4px' }}></div>
                <div className="count-bar fair" style={{ height: '8px' }}></div>
                <div className="count-bar good" style={{ height: '18px' }}></div>
                <div className="count-bar excellent" style={{ height: '24px' }}></div>
              </div>,
            ],
            [
              <strong key="total">Total</strong>,
              <strong key="total-num">3,847</strong>,
              <strong key="total-desc">68%</strong>,
              <strong key="total-own">74%</strong>,
              <div key="total-bar" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill good" style={{ width: '67%' }}></div>
                </div>
                <span className="bar-value">
                  <strong>67</strong>
                </span>
              </div>,
              '—',
            ],
          ]}
        />
      </PivotSection>

      <div className="section-divider">
        <span>Domain Health Pivots</span>
      </div>

      {/* Pivot 2: Domain × Quality Dimension Heatmap */}
      <PivotSection
        title="Quality Scorecard: Domain × Dimension"
        subtitle="Heatmap showing quality scores across all five dimensions by business domain"
        meta={[
          { label: '📊', value: '6 domains' },
          { label: '🕐', value: 'Updated 2m ago' },
        ]}
        rows={
          <span className="chip">
            <span className="chip-icon">🏢</span> Domain
          </span>
        }
        columns={<span className="chip">Quality Dimensions (5)</span>}
        insights={[
          {
            type: 'danger',
            message: '<strong>HR Domain</strong> needs immediate attention — 32% overall, declining 5%',
          },
          {
            type: 'warning',
            message: '<strong>Marketing Timeliness</strong> at 41% — metadata is going stale rapidly',
          },
          {
            type: 'info',
            message: '<strong>Product Domain</strong> improved 8% — Q4 enrichment campaign working',
          },
        ]}
      >
        <PivotTable
          headers={['Domain', 'Completeness', 'Accuracy', 'Timeliness', 'Consistency', 'Usability', 'Overall', 'Δ 30d']}
          rows={[
            [
              <span key="cust">
                <span className="dim-icon domain">💳</span>Customer Data
              </span>,
              <span key="cust-comp" className={`heat-cell ${getHeatClass(92)}`}>
                92
              </span>,
              <span key="cust-acc" className={`heat-cell ${getHeatClass(78)}`}>
                78
              </span>,
              <span key="cust-time" className={`heat-cell ${getHeatClass(85)}`}>
                85
              </span>,
              <span key="cust-cons" className={`heat-cell ${getHeatClass(71)}`}>
                71
              </span>,
              <span key="cust-use" className={`heat-cell ${getHeatClass(88)}`}>
                88
              </span>,
              <span key="cust-overall" className={`score-cell ${getScoreClass(83)}`}>
                83
              </span>,
              <span key="cust-trend" className="trend up">
                ↑ 4%
              </span>,
            ],
            [
              <span key="fin">
                <span className="dim-icon domain">💰</span>Financial
              </span>,
              <span key="fin-comp" className={`heat-cell ${getHeatClass(88)}`}>
                88
              </span>,
              <span key="fin-acc" className={`heat-cell ${getHeatClass(91)}`}>
                91
              </span>,
              <span key="fin-time" className={`heat-cell ${getHeatClass(76)}`}>
                76
              </span>,
              <span key="fin-cons" className={`heat-cell ${getHeatClass(84)}`}>
                84
              </span>,
              <span key="fin-use" className={`heat-cell ${getHeatClass(79)}`}>
                79
              </span>,
              <span key="fin-overall" className={`score-cell ${getScoreClass(84)}`}>
                84
              </span>,
              <span key="fin-trend" className="trend up">
                ↑ 2%
              </span>,
            ],
            [
              <span key="prod">
                <span className="dim-icon domain">📦</span>Product
              </span>,
              <span key="prod-comp" className={`heat-cell ${getHeatClass(74)}`}>
                74
              </span>,
              <span key="prod-acc" className={`heat-cell ${getHeatClass(62)}`}>
                62
              </span>,
              <span key="prod-time" className={`heat-cell ${getHeatClass(68)}`}>
                68
              </span>,
              <span key="prod-cons" className={`heat-cell ${getHeatClass(55)}`}>
                55
              </span>,
              <span key="prod-use" className={`heat-cell ${getHeatClass(71)}`}>
                71
              </span>,
              <span key="prod-overall" className={`score-cell ${getScoreClass(66)}`}>
                66
              </span>,
              <span key="prod-trend" className="trend up">
                ↑ 8%
              </span>,
            ],
            [
              <span key="mkt">
                <span className="dim-icon domain">📢</span>Marketing
              </span>,
              <span key="mkt-comp" className={`heat-cell ${getHeatClass(58)}`}>
                58
              </span>,
              <span key="mkt-acc" className={`heat-cell ${getHeatClass(52)}`}>
                52
              </span>,
              <span key="mkt-time" className={`heat-cell ${getHeatClass(41)}`}>
                41
              </span>,
              <span key="mkt-cons" className={`heat-cell ${getHeatClass(38)}`}>
                38
              </span>,
              <span key="mkt-use" className={`heat-cell ${getHeatClass(49)}`}>
                49
              </span>,
              <span key="mkt-overall" className={`score-cell ${getScoreClass(48)}`}>
                48
              </span>,
              <span key="mkt-trend" className="trend down">
                ↓ 3%
              </span>,
            ],
            [
              <span key="ops">
                <span className="dim-icon domain">⚙️</span>Operations
              </span>,
              <span key="ops-comp" className={`heat-cell ${getHeatClass(65)}`}>
                65
              </span>,
              <span key="ops-acc" className={`heat-cell ${getHeatClass(58)}`}>
                58
              </span>,
              <span key="ops-time" className={`heat-cell ${getHeatClass(72)}`}>
                72
              </span>,
              <span key="ops-cons" className={`heat-cell ${getHeatClass(61)}`}>
                61
              </span>,
              <span key="ops-use" className={`heat-cell ${getHeatClass(54)}`}>
                54
              </span>,
              <span key="ops-overall" className={`score-cell ${getScoreClass(62)}`}>
                62
              </span>,
              <span key="ops-trend" className="trend flat">
                → 0%
              </span>,
            ],
            [
              <span key="hr">
                <span className="dim-icon domain">👥</span>HR
              </span>,
              <span key="hr-comp" className={`heat-cell ${getHeatClass(42)}`}>
                42
              </span>,
              <span key="hr-acc" className={`heat-cell ${getHeatClass(28)}`}>
                28
              </span>,
              <span key="hr-time" className={`heat-cell ${getHeatClass(35)}`}>
                35
              </span>,
              <span key="hr-cons" className={`heat-cell ${getHeatClass(22)}`}>
                22
              </span>,
              <span key="hr-use" className={`heat-cell ${getHeatClass(31)}`}>
                31
              </span>,
              <span key="hr-overall" className={`score-cell ${getScoreClass(32)}`}>
                32
              </span>,
              <span key="hr-trend" className="trend down">
                ↓ 5%
              </span>,
            ],
          ]}
        />
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--score-excellent)' }}></div>
            Excellent (80+)
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--score-good)' }}></div>
            Good (60-79)
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--score-fair)' }}></div>
            Fair (40-59)
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--score-poor)' }}></div>
            Poor (20-39)
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--score-critical)' }}></div>
            Critical (0-19)
          </div>
        </div>
      </PivotSection>

      <div className="section-divider">
        <span>Accountability Pivots</span>
      </div>

      {/* Pivot 3: Owner × Certification Status */}
      <PivotSection
        title="Owner Accountability: Certification Coverage"
        subtitle="Who is certifying their assets vs. leaving them in draft or unverified state?"
        meta={[
          { label: '📊', value: '2,356 assets' },
          { label: '👥', value: '7 owner groups' },
        ]}
        rows={
          <span className="chip">
            <span className="chip-icon">👤</span> Owner Group
          </span>
        }
        columns={<span className="chip">Certification Status</span>}
        insights={[
          {
            type: 'danger',
            message: '<strong>237 unowned assets</strong> — cannot be certified without owners',
          },
          {
            type: 'warning',
            message: '<strong>Marketing (14%)</strong> and <strong>Operations (22%)</strong> need certification push',
          },
          {
            type: 'success',
            message: '<strong>Finance at 83%</strong> — use as template for other teams',
          },
        ]}
      >
        <PivotTable
          headers={[
            'Owner Group',
            <span key="cert" className="status-badge certified">
              ✓ Certified
            </span>,
            <span key="draft" className="status-badge draft">
              ◐ Draft
            </span>,
            <span key="dep" className="status-badge deprecated">
              ✗ Deprecated
            </span>,
            <span key="none" className="status-badge none">
              ○ None
            </span>,
            'Total',
            'Cert Rate',
          ]}
          rows={[
            [
              <span key="de">
                <span className="dim-icon owner">👤</span>Data Engineering
              </span>,
              '234',
              '89',
              '12',
              '87',
              <strong key="de-total">422</strong>,
              <span key="de-rate" className={`score-cell ${getScoreClass(55)}`}>
                55%
              </span>,
            ],
            [
              <span key="analytics">
                <span className="dim-icon owner">👤</span>Analytics
              </span>,
              '312',
              '67',
              '8',
              '45',
              <strong key="analytics-total">432</strong>,
              <span key="analytics-rate" className={`score-cell ${getScoreClass(72)}`}>
                72%
              </span>,
            ],
            [
              <span key="finance">
                <span className="dim-icon owner">👤</span>Finance
              </span>,
              '287',
              '34',
              '5',
              '18',
              <strong key="finance-total">344</strong>,
              <span key="finance-rate" className={`score-cell ${getScoreClass(83)}`}>
                83%
              </span>,
            ],
            [
              <span key="marketing">
                <span className="dim-icon owner">👤</span>Marketing
              </span>,
              '45',
              '112',
              '23',
              '134',
              <strong key="marketing-total">314</strong>,
              <span key="marketing-rate" className={`score-cell ${getScoreClass(14)}`}>
                14%
              </span>,
            ],
            [
              <span key="product">
                <span className="dim-icon owner">👤</span>Product
              </span>,
              '123',
              '78',
              '15',
              '89',
              <strong key="product-total">305</strong>,
              <span key="product-rate" className={`score-cell ${getScoreClass(40)}`}>
                40%
              </span>,
            ],
            [
              <span key="ops">
                <span className="dim-icon owner">👤</span>Operations
              </span>,
              '67',
              '89',
              '34',
              '112',
              <strong key="ops-total">302</strong>,
              <span key="ops-rate" className={`score-cell ${getScoreClass(22)}`}>
                22%
              </span>,
            ],
            [
              <span key="unowned" style={{ color: 'var(--accent-danger)' }}>
                <span className="dim-icon owner" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-danger)' }}>
                  ⚠
                </span>
                Unowned
              </span>,
              <span key="unowned-cert" style={{ color: 'var(--text-muted)' }}>
                0
              </span>,
              '12',
              '8',
              <span key="unowned-none" style={{ color: 'var(--accent-danger)' }}>
                217
              </span>,
              <strong key="unowned-total" style={{ color: 'var(--accent-danger)' }}>
                237
              </strong>,
              <span key="unowned-rate" className={`score-cell ${getScoreClass(0)}`}>
                0%
              </span>,
            ],
            [
              <strong key="total">Total</strong>,
              <strong key="total-cert">1,068</strong>,
              <strong key="total-draft">481</strong>,
              <strong key="total-dep">105</strong>,
              <strong key="total-none">702</strong>,
              <strong key="total-all">2,356</strong>,
              <span key="total-rate" className={`score-cell ${getScoreClass(45)}`}>
                45%
              </span>,
            ],
          ]}
        />
      </PivotSection>

      <div className="section-divider">
        <span>Lineage & Supply Chain</span>
      </div>

      {/* Pivot 4: Lineage Coverage */}
      <PivotSection
        title="Lineage Coverage: Source Systems"
        subtitle="Which connections have documented lineage vs. orphaned assets?"
        meta={[
          { label: '📊', value: '4,521 assets' },
          { label: '🔗', value: '5 connections' },
        ]}
        rows={
          <span className="chip">
            <span className="chip-icon">🔗</span> Connection
          </span>
        }
        measures={
          <>
            <span className="chip">Has Upstream</span>
            <span className="chip">Has Downstream</span>
            <span className="chip">Full Lineage</span>
            <span className="chip">Orphaned</span>
          </>
        }
        insights={[
          {
            type: 'danger',
            message: '<strong>289 orphaned assets</strong> in PostgreSQL Legacy — no lineage context',
          },
          {
            type: 'warning',
            message: '<strong>Tableau</strong> has 94% upstream but only 12% downstream — normal for BI layer',
          },
          {
            type: 'success',
            message: '<strong>dbt Models</strong> at 99% coverage — leverage for propagation rules',
          },
        ]}
      >
        <PivotTable
          headers={['Connection', 'Total', 'Has Upstream', 'Has Downstream', 'Full Lineage', 'Orphaned ⚠', 'Coverage']}
          rows={[
            [
              <span key="sf">
                <span className="dim-icon connection">❄️</span>Snowflake Production
              </span>,
              '1,245',
              <div key="sf-up" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '89%' }}></div>
                </div>
                <span className="bar-value">89%</span>
              </div>,
              <div key="sf-down" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '92%' }}></div>
                </div>
                <span className="bar-value">92%</span>
              </div>,
              <div key="sf-full" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '84%' }}></div>
                </div>
                <span className="bar-value">84%</span>
              </div>,
              <span key="sf-orphan" style={{ color: 'var(--accent-danger)' }}>
                67
              </span>,
              <span key="sf-cov" className={`score-cell ${getScoreClass(95)}`}>
                95%
              </span>,
            ],
            [
              <span key="bq">
                <span className="dim-icon connection">🔷</span>BigQuery Analytics
              </span>,
              '892',
              <div key="bq-up" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill good" style={{ width: '76%' }}></div>
                </div>
                <span className="bar-value">76%</span>
              </div>,
              <div key="bq-down" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill good" style={{ width: '68%' }}></div>
                </div>
                <span className="bar-value">68%</span>
              </div>,
              <div key="bq-full" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill fair" style={{ width: '58%' }}></div>
                </div>
                <span className="bar-value">58%</span>
              </div>,
              <span key="bq-orphan" style={{ color: 'var(--accent-danger)' }}>
                156
              </span>,
              <span key="bq-cov" className={`score-cell ${getScoreClass(83)}`}>
                83%
              </span>,
            ],
            [
              <span key="pg">
                <span className="dim-icon connection">🐘</span>PostgreSQL Legacy
              </span>,
              '567',
              <div key="pg-up" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill poor" style={{ width: '23%' }}></div>
                </div>
                <span className="bar-value">23%</span>
              </div>,
              <div key="pg-down" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill fair" style={{ width: '45%' }}></div>
                </div>
                <span className="bar-value">45%</span>
              </div>,
              <div key="pg-full" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill poor" style={{ width: '18%' }}></div>
                </div>
                <span className="bar-value">18%</span>
              </div>,
              <span key="pg-orphan" style={{ color: 'var(--accent-danger)' }}>
                289
              </span>,
              <span key="pg-cov" className={`score-cell ${getScoreClass(49)}`}>
                49%
              </span>,
            ],
            [
              <span key="tb">
                <span className="dim-icon connection">📊</span>Tableau Workbooks
              </span>,
              '1,143',
              <div key="tb-up" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '94%' }}></div>
                </div>
                <span className="bar-value">94%</span>
              </div>,
              <div key="tb-down" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill poor" style={{ width: '12%' }}></div>
                </div>
                <span className="bar-value">12%</span>
              </div>,
              <div key="tb-full" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill poor" style={{ width: '12%' }}></div>
                </div>
                <span className="bar-value">12%</span>
              </div>,
              <span key="tb-orphan" style={{ color: 'var(--text-muted)' }}>
                34
              </span>,
              <span key="tb-cov" className={`score-cell ${getScoreClass(97)}`}>
                97%
              </span>,
            ],
            [
              <span key="dbt">
                <span className="dim-icon connection">🔶</span>dbt Models
              </span>,
              '674',
              <div key="dbt-up" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '98%' }}></div>
                </div>
                <span className="bar-value">98%</span>
              </div>,
              <div key="dbt-down" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '96%' }}></div>
                </div>
                <span className="bar-value">96%</span>
              </div>,
              <div key="dbt-full" className="bar-cell">
                <div className="bar-container">
                  <div className="bar-fill excellent" style={{ width: '95%' }}></div>
                </div>
                <span className="bar-value">95%</span>
              </div>,
              <span key="dbt-orphan" style={{ color: 'var(--text-muted)' }}>
                8
              </span>,
              <span key="dbt-cov" className={`score-cell ${getScoreClass(99)}`}>
                99%
              </span>,
            ],
            [
              <strong key="total">Total</strong>,
              <strong key="total-num">4,521</strong>,
              <strong key="total-up">78%</strong>,
              <strong key="total-down">62%</strong>,
              <strong key="total-full">54%</strong>,
              <strong key="total-orphan" style={{ color: 'var(--accent-danger)' }}>
                554
              </strong>,
              <span key="total-cov" className={`score-cell ${getScoreClass(88)}`}>
                88%
              </span>,
            ],
          ]}
        />
      </PivotSection>
    </div>
  );
}

