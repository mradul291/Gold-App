//Metrics Tab
window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.metrics = function ($mount, state) {
  const html = `
        <div class="wmt-root">

            <!-- Page Title -->
            <div class="wmt-title">Transaction Metrics</div>

            <!-- WEIGHT & PURITY ANALYSIS -->
            <div class="wmt-card">
                <div class="wmt-card-header">WEIGHT & PURITY ANALYSIS</div>

                <div class="wmt-two-col">
                    <div class="wmt-col">

                        <div class="wmt-row">
                            <div class="wmt-label">Original Gross Weight</div>
                            <div class="wmt-value">300.00 g</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Weight Loss</div>
                            <div class="wmt-value wmt-negative">5.00 g</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">XAU Weight Loss</div>
                            <div class="wmt-value wmt-negative">19.44 g</div>
                        </div>

                        <div class="wmt-divider"></div>

                        <div class="wmt-row">
                            <div class="wmt-label">Original Avg Purity</div>
                            <div class="wmt-value">388.83%</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Purity Variance</div>
                            <div class="wmt-value wmt-negative">-296.33%</div>
                        </div>
                    </div>

                    <div class="wmt-col">

                        <div class="wmt-row">
                            <div class="wmt-label">Weight After Melting</div>
                            <div class="wmt-value">295.00 g</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Weight Loss %</div>
                            <div class="wmt-value wmt-negative">1.67%</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Net Weight For Sale</div>
                            <div class="wmt-value">293.00 g</div>
                        </div>

                        <div class="wmt-divider"></div>

                        <div class="wmt-row">
                            <div class="wmt-label">Assay Purity</div>
                            <div class="wmt-value">92.50%</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">XAU Weight Variance</div>
                            <div class="wmt-value wmt-negative">-874.18 g</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- COST + PROFIT -->
            <div class="wmt-bottom-grid">
                <div class="wmt-card">
                    <div class="wmt-card-header">COST ANALYSIS</div>

                    <div class="wmt-row">
                        <div class="wmt-label">Original Gold Cost</div>
                        <div class="wmt-value">RM 23,500.00</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Melting Cost</div>
                        <div class="wmt-value">RM 150.00</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Assay Cost</div>
                        <div class="wmt-value">RM 100.00</div>
                    </div>

                    <div class="wmt-divider"></div>

                    <div class="wmt-row wmt-total-row">
                        <div class="wmt-label">Total Cost</div>
                        <div class="wmt-value">RM 23,750.00</div>
                    </div>
                </div>

                <div class="wmt-card wmt-profit-card">
                    <div class="wmt-card-header">REVENUE & PROFIT</div>

                    <div class="wmt-row">
                        <div class="wmt-label">Total Revenue</div>
                        <div class="wmt-value">RM 510,688.14</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Total Cost</div>
                        <div class="wmt-value">RM 23,750.00</div>
                    </div>

                    <div class="wmt-divider"></div>

                    <div class="wmt-row wmt-profit-row">
                        <div class="wmt-label">Gross Profit</div>
                        <div class="wmt-profit-value">RM 486,938.14</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Profit Margin</div>
                        <div class="wmt-profit-percent">95.35%</div>
                    </div>
                </div>
            </div>

             <!-- PROCESS EFFICIENCY -->
            <div class="wmt-card">
                <div class="wmt-card-header">PROCESS EFFICIENCY</div>

                <div class="wmt-efficiency-grid">
                    <div class="wmt-eff-card">
                        <div class="wmt-eff-label">Melting Efficiency</div>
                        <div class="wmt-eff-value">98.3%</div>
                    </div>

                    <div class="wmt-eff-card wmt-eff-green">
                        <div class="wmt-eff-label">XAU Recovery</div>
                        <div class="wmt-eff-value">23.8%</div>
                    </div>

                    <div class="wmt-eff-card wmt-eff-blue">
                        <div class="wmt-eff-label">Net Sellable</div>
                        <div class="wmt-eff-value">97.7%</div>
                    </div>

                    <div class="wmt-eff-card wmt-eff-purple">
                        <div class="wmt-eff-label">Profit per XAU</div>
                        <div class="wmt-eff-value">1797</div>
                    </div>
                </div>
            </div>

            <!-- VS LAST SALE -->
            <div class="wmt-card">
                <div class="wmt-card-header">VS LAST SALE</div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Weight Loss %</div>
                    <div class="wmt-compare-old">2.10%</div>
                    <div class="wmt-compare-new">1.67%</div>
                    <div class="wmt-compare-diff wmt-positive">+0.43%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">XAU Recovery Rate</div>
                    <div class="wmt-compare-old">102.50%</div>
                    <div class="wmt-compare-new">23.79%</div>
                    <div class="wmt-compare-diff wmt-negative">-78.71%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Purity Variance</div>
                    <div class="wmt-compare-old">2.80%</div>
                    <div class="wmt-compare-new">-296.33%</div>
                    <div class="wmt-compare-diff wmt-negative">-299.13%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Net Sellable %</div>
                    <div class="wmt-compare-old">96.90%</div>
                    <div class="wmt-compare-new">97.67%</div>
                    <div class="wmt-compare-diff wmt-positive">+0.77%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Profit Margin</div>
                    <div class="wmt-compare-old">94.80%</div>
                    <div class="wmt-compare-new">95.35%</div>
                    <div class="wmt-compare-diff wmt-positive">+0.55%</div>
                </div>
            </div>

        </div>
    `;

  $mount.html(html);

  // ---------------------------------------------------------
  // COMPUTE METRICS AND STORE IN STATE
  // ---------------------------------------------------------
  (function computeMetrics() {
    const s = state.bag_summary || {};
    const melt = state.melting || {};
    const assay = state.assay || {};
    const sale = state.sale || {};

    // BAG SUMMARY VALUES
    const grossWeight = s.total_weight_g || 0;
    const avgPurity = s.average_purity || 0;
    const originalGoldCost = s.total_cost_basis || 0;

    // MELTING VALUES
    const afterMelting = melt.after || 0;
    const weightLoss = melt.weight_loss || 0;
    const xauLoss = melt.xau_loss || 0;
    const weightLossPct = melt.loss_percentage || 0;

    // ASSAY VALUES
    const assayPurity = assay.assay_purity || 0;
    const purityVariance = assay.purity_variance || 0;
    const xauVariance = assay.xau_weight_variance || 0;

    const netWeightSale = assay.sample_weight
      ? afterMelting - assay.sample_weight
      : afterMelting;
    const netSellableXau = assay.net_sellable || 0;

    // COST METRICS
    const meltingCost = melt.cost || 0;
    const assayCost = assay.cost || 0;
    const totalCost = originalGoldCost + meltingCost + assayCost;

    // REVENUE & PROFIT
    const revenue = sale.total_revenue || 0;
    const grossProfit = revenue - totalCost;
    const profitMargin = revenue ? (grossProfit / revenue) * 100 : 0;

    // EFFICIENCY
    const meltingEfficiency = grossWeight
      ? (afterMelting / grossWeight) * 100
      : 0;
    const xauRecovery = s.pure_gold_xau_g
      ? (netSellableXau / s.pure_gold_xau_g) * 100
      : 0;
    const netSellablePct = grossWeight
      ? (netWeightSale / grossWeight) * 100
      : 0;
    const profitPerXau = netSellableXau ? grossProfit / netSellableXau : 0;

    // FINAL METRICS OBJECT STORED IN STATE
    state.metrics = {
      // Weight & Purity
      m_original_gross_weight: grossWeight,
      m_weight_after_melting: afterMelting,
      m_weight_loss: weightLoss,
      m_weight_loss_percentage: weightLossPct,
      m_xau_weight_loss: xauLoss,
      m_net_weight_sale: netWeightSale,

      m_original_avg_purity: avgPurity,
      m_assay_purity: assayPurity,
      m_purity_variance: purityVariance,
      m_xau_weight_variance: xauVariance,

      // Cost
      m_original_gold_cost: originalGoldCost,
      m_melting_cost: meltingCost,
      m_assay_cost: assayCost,
      m_total_cost: totalCost,

      // Revenue
      m_total_revenue: revenue,
      m_total_cost_profit: totalCost,
      m_gross_profit: grossProfit,
      m_profit_margin: profitMargin,

      // Efficiency
      m_melting_efficiency: meltingEfficiency,
      m_xau_recovery: xauRecovery,
      m_net_sellable: netSellablePct,
      m_profit_per_xau: profitPerXau,

      // VS Last Sale (Static UI values)
      vs_weight_loss_percentage: 2.1,
      vs_xau_recovery_rate: 102.5,
      vs_purity_variance: 2.8,
      vs_net_sellable_percentage: 96.9,
      vs_profit_margin: 94.8,
    };
  })();
};
