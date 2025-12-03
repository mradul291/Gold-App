// public/js/bag_summary.js

window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.bag_summary = function ($mount, state) {
	const summary = state.bag_summary;
	const items = state.bag_items || [];

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

	// INNER UI ONLY — NO HEADER, NO TABS, NO PAGE SHELL
	const html = `
        <div>

            <!-- Section title -->
            <div class="wbm-section-title">BAG SUMMARY - ${summary.source_bag}</div>

            <!-- Summary chips -->
            <div class="wbm-summary-strip">

                <div class="wbm-summary-chip">
                    <div class="wbm-chip-label">Source Bag</div>
                    <div class="wbm-chip-value wbm-chip-link">${summary.source_bag}</div>
                </div>

                <div class="wbm-summary-chip">
                    <div class="wbm-chip-label">Total Weight</div>
                    <div class="wbm-chip-value">${formatNumber(summary.total_weight_g, 0)}g</div>
                </div>

                <div class="wbm-summary-chip">
                    <div class="wbm-chip-label">Pure Gold (XAU)</div>
                    <div class="wbm-chip-value">${formatNumber(summary.pure_gold_xau_g, 2)}g</div>
                </div>

                <div class="wbm-summary-chip">
                    <div class="wbm-chip-label">Average Purity</div>
                    <div class="wbm-chip-value">${formatNumber(summary.average_purity, 1)}</div>
                </div>

                <div class="wbm-summary-chip">
                    <div class="wbm-chip-label">Total Cost Basis</div>
                    <div class="wbm-chip-value">${formatRM(summary.total_cost_basis)}</div>
                </div>

                <div class="wbm-summary-chip">
                    <div class="wbm-chip-label">Cost per Gram</div>
                    <div class="wbm-chip-value">RM${formatNumber(summary.cost_per_gram, 2)}</div>
                </div>

            </div>

            <!-- Items in bag -->
            <div class="wbm-subsection-title">ITEMS IN BAG</div>

            <div class="wbm-table-wrapper">
                <table class="table wbm-items-table">
                    <thead>
                        <tr>
                            <th>PURITY</th>
                            <th class="text-right">WEIGHT (G)</th>
                            <th class="text-right">XAU (G)</th>
                            <th class="text-right">COST (RM)</th>
                            <th class="text-right">COST/G (RM)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items
							.map(
								(row) => `
                            <tr>
                                <td>${row.purity}</td>
                                <td class="text-right">${formatNumber(row.weight_g, 0)}</td>
                                <td class="text-right">${formatNumber(row.xau_g, 2)}</td>
                                <td class="text-right">${formatRM(row.cost_rm)}</td>
                                <td class="text-right">${formatNumber(row.cost_per_g_rm, 2)}</td>
                            </tr>
                        `
							)
							.join("")}
                    </tbody>
                </table>
            </div>

            <!-- Bottom footer -->
            <div class="wbm-main-footer">
                <button class="btn btn-default wbm-back-btn">← Back to Bags</button>
            </div>

        </div>
    `;

	// Mount UI
	$mount.html(html);

	// Back button handler
	$mount.find(".wbm-back-btn").on("click", function () {
		if (state.onBackToBags) state.onBackToBags();
	});

	// Save button handler (SAVE is in the global header)
	$(".wbm-save-btn")
		.off("click")
		.on("click", function () {
			if (state.onSaveRecord) state.onSaveRecord();
		});
};
