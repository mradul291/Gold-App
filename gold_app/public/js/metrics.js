// public/js/metrics.js

window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.metrics = function ($mount, state) {
	const metrics = state.metrics || {
		// Weight loss analysis
		pre_melt_weight_g: 740.0,
		post_melt_weight_g: 725.0,
		loss_g: 15.0,
		loss_pct: 2.03,

		// Purity variance analysis
		est_purity: 903.5,
		actual_purity: 905.2,
		variance: 1.7,
		status: "BETTER",

		// Net XAU effect
		xau_before_est: 668.373,
		xau_after_actual: 656.279,
		net_xau_change_g: -12.094,
		net_xau_change_pct: -1.81,
		analysis_text:
			"Despite +1.7 purity gain, 2.03% weight loss resulted in net 1.81% XAU reduction",

		// Cost & margin analysis
		original_cost_rm: 45200.0,
		melting_cost_rm: 350.0,
		assay_cost_rm: 150.0,
		refining_cost_rm: 0.0,
		total_cost_basis_rm: 45700.0,
		gross_sale_value_rm: 48500.0,
		hedge_pl_rm: "",
		gross_margin_rm: 2800.0,
		net_profit_rm: 3250.0,
		gross_margin_pct: 6.13,
		net_profit_pct: 7.11,
		gross_margin_per_g: 3.78,
		net_profit_per_g: 4.39,

		// Summary insights
		insight_1: "Net XAU loss of 1.81% despite purity improvement.",
		insight_2: "Hedging added RM450 to protect margins.",
		insight_3: "Final net profit: 7.11% (RM4.39/g).",
	};

	const formatNumber = (val, decimals) => {
		if (val === null || val === undefined || val === "") return "";
		const n = typeof val === "number" ? val : parseFloat(String(val));
		return n.toLocaleString("en-MY", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	};

	const formatRM = (val) => {
		if (val === null || val === undefined || val === "") return "";
		const n = typeof val === "number" ? val : parseFloat(String(val));
		return (
			"RM" +
			n.toLocaleString("en-MY", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})
		);
	};

	const html = `
        <div class="mtx-wrapper">

            <!-- PERFORMANCE METRICS -->
            <div class="mtx-section-header">
                <span>PERFORMANCE METRICS</span>
            </div>

            <div class="mtx-top-row">
                <!-- Weight Loss Analysis -->
                <div class="mtx-card mtx-half">
                    <div class="mtx-card-title">WEIGHT LOSS ANALYSIS</div>
                    <div class="mtx-card-body">
                        <div class="mtx-row">
                            <span>Pre-Melt</span>
                            <span class="mtx-value">${formatNumber(
								metrics.pre_melt_weight_g,
								3
							)}g</span>
                        </div>
                        <div class="mtx-row">
                            <span>Post-Melt</span>
                            <span class="mtx-value">${formatNumber(
								metrics.post_melt_weight_g,
								3
							)}g</span>
                        </div>
                        <div class="mtx-row mtx-row-loss">
                            <span>Loss</span>
                            <span class="mtx-value mtx-loss-red">${formatNumber(
								metrics.loss_g,
								3
							)}g</span>
                        </div>
                        <div class="mtx-row mtx-row-loss">
                            <span>Loss %</span>
                            <span class="mtx-value mtx-loss-red">${formatNumber(
								metrics.loss_pct,
								2
							)}%</span>
                        </div>
                    </div>
                </div>

                <!-- Purity Variance Analysis -->
                <div class="mtx-card mtx-half">
                    <div class="mtx-card-title">PURITY VARIANCE ANALYSIS</div>
                    <div class="mtx-card-body">
                        <div class="mtx-row">
                            <span>Estimated</span>
                            <span class="mtx-value">${formatNumber(metrics.est_purity, 1)}</span>
                        </div>
                        <div class="mtx-row">
                            <span>Actual</span>
                            <span class="mtx-value">${formatNumber(
								metrics.actual_purity,
								1
							)}</span>
                        </div>
                        <div class="mtx-row">
                            <span>Variance</span>
                            <span class="mtx-value mtx-variance-green">+${formatNumber(
								metrics.variance,
								1
							)}</span>
                        </div>
                        <div class="mtx-row">
                            <span>Status</span>
                            <span class="mtx-value mtx-status-better">${metrics.status}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Net XAU Effect card -->
            <div class="mtx-card mtx-net-card">
                <div class="mtx-card-title">NET XAU EFFECT (COMBINED IMPACT)</div>
                <div class="mtx-card-body mtx-net-body">
                    <div class="mtx-net-row">
                        <div class="mtx-net-label">XAU Before (Estimated)</div>
                        <div class="mtx-net-value">${formatNumber(metrics.xau_before_est, 3)}</div>
                    </div>
                    <div class="mtx-net-row">
                        <div class="mtx-net-label">XAU After (Actual)</div>
                        <div class="mtx-net-value">${formatNumber(
							metrics.xau_after_actual,
							3
						)}</div>
                    </div>
                    <div class="mtx-net-row mtx-net-row-change">
                        <div class="mtx-net-label">Net XAU Change</div>
                        <div class="mtx-net-value mtx-loss-red">
                            ${formatNumber(metrics.net_xau_change_g, 3)}g (${formatNumber(
		metrics.net_xau_change_pct,
		2
	)}%)
                        </div>
                    </div>

                    <div class="mtx-analysis-row">
                        <span class="mtx-analysis-label">Analysis:</span>
                        <span class="mtx-analysis-text">${metrics.analysis_text}</span>
                    </div>
                </div>
            </div>

            <!-- COST & MARGIN ANALYSIS -->
            <div class="mtx-section-header mtx-section-header-spacing">
                <span>COST &amp; MARGIN ANALYSIS</span>
            </div>

            <div class="mtx-card mtx-cost-card">
                <div class="mtx-card-body">
                    <div class="mtx-cost-row">
                        <div class="mtx-cost-label">Original Cost (from bag)</div>
                        <div class="mtx-cost-value">${formatRM(metrics.original_cost_rm)}</div>
                    </div>
                    <div class="mtx-cost-row">
                        <div class="mtx-cost-label">Melting Cost</div>
                        <div class="mtx-cost-value">${formatRM(metrics.melting_cost_rm)}</div>
                    </div>
                    <div class="mtx-cost-row">
                        <div class="mtx-cost-label">Assay Cost</div>
                        <div class="mtx-cost-value">${formatRM(metrics.assay_cost_rm)}</div>
                    </div>
                    <div class="mtx-cost-row">
                        <div class="mtx-cost-label">Refining Cost</div>
                        <div class="mtx-cost-value">${formatRM(metrics.refining_cost_rm)}</div>
                    </div>

                    <div class="mtx-cost-row mtx-cost-row-strong">
                        <div class="mtx-cost-label">Total Cost Basis</div>
                        <div class="mtx-cost-value">${formatRM(metrics.total_cost_basis_rm)}</div>
                    </div>

                    <div class="mtx-cost-row mtx-cost-row-strong">
                        <div class="mtx-cost-label">Gross Sale Value</div>
                        <div class="mtx-cost-value">${formatRM(metrics.gross_sale_value_rm)}</div>
                    </div>

                    <div class="mtx-cost-row mtx-cost-row-input">
                        <div class="mtx-cost-label">Hedge P/L (optional)</div>
                        <div class="mtx-cost-input-wrap">
                            <input type="text" class="mtx-input" placeholder="Enter hedge profit/loss">
                        </div>
                    </div>

                    <!-- Margin results (right-aligned, green) -->
                    <div class="mtx-margin-results">
                        <div class="mtx-margin-row">
                            <span>Gross Margin</span>
                            <span class="mtx-margin-value">${formatRM(
								metrics.gross_margin_rm
							)}</span>
                        </div>
                        <div class="mtx-margin-row">
                            <span>Net Profit (hedged)</span>
                            <span class="mtx-margin-value">${formatRM(
								metrics.net_profit_rm
							)}</span>
                        </div>
                        <div class="mtx-margin-row">
                            <span>Gross Margin %</span>
                            <span class="mtx-margin-value">${formatNumber(
								metrics.gross_margin_pct,
								2
							)}%</span>
                        </div>
                        <div class="mtx-margin-row">
                            <span>Net Profit %</span>
                            <span class="mtx-margin-value">${formatNumber(
								metrics.net_profit_pct,
								2
							)}%</span>
                        </div>
                        <div class="mtx-margin-row">
                            <span>Gross Margin per Gram</span>
                            <span class="mtx-margin-value">${formatRM(
								metrics.gross_margin_per_g
							)}/g</span>
                        </div>
                        <div class="mtx-margin-row">
                            <span>Net Profit per Gram</span>
                            <span class="mtx-margin-value">${formatRM(
								metrics.net_profit_per_g
							)}/g</span>
                        </div>

                        <div class="mtx-note">
                            * Based on pre-sale weight of 740g
                        </div>
                    </div>
                </div>
            </div>

            <!-- SUMMARY INSIGHTS -->
            <div class="mtx-section-header mtx-section-header-spacing">
                <span>SUMMARY INSIGHTS</span>
            </div>

            <div class="mtx-summary-card">
                <ul class="mtx-summary-list">
                    <li>${metrics.insight_1}</li>
                    <li>${metrics.insight_2}</li>
                    <li>${metrics.insight_3}</li>
                </ul>

                <div class="mtx-summary-buttons">
                    <button class="btn btn-default mtx-summary-btn">View Historical Comparison</button>
                    <button class="btn btn-default mtx-summary-btn">Compare: Melt vs Jewelry Sale</button>
                </div>
            </div>

            <div class="mtx-footer-bar">
                <button class="btn btn-default wbm-back-btn">← Back to Bags</button>
            </div>

        </div>
    `;

	$mount.html(html);

	$mount.find(".wbm-back-btn").on("click", function () {
		if (state.onBackToBags) state.onBackToBags();
	});

	$(".wbm-save-btn")
		.off("click.metrics")
		.on("click.metrics", function () {
			if (state.onSaveRecord) state.onSaveRecord();
		});
};
