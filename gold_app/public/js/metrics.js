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
};
