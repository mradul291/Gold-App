window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.bag_summary = function ($mount, state) {
	// -----------------------------
	// Safety checks
	// -----------------------------
	const items = state.bag_items || [];
	const summary = state.bag_summary || {};

	// -----------------------------
	// Number formatter
	// -----------------------------
	const fmt = (val, decimals = 2) => {
		if (val === null || val === undefined || val === "") return "—";
		const num = Number(val);
		if (isNaN(num)) return "—";
		return num.toLocaleString("en-MY", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	};

	// -----------------------------
	// Build Bag Content Rows
	// -----------------------------
	const rowsHtml = items.length
		? items
				.map((r) => {
					const xauAvco = r.xau_g && r.xau_g !== 0 ? r.cost_rm / r.xau_g : 0;

					return `
						<div class="wbm-table-data-row">
							<div class="wbm-col wbm-col-purity">
								<span class="wbm-pill">${r.purity}</span>
							</div>
							<div class="wbm-col wbm-col-weight text-right">
								${fmt(r.weight_g)} g
							</div>
							<div class="wbm-col wbm-col-avco text-right">
								RM ${fmt(r.cost_per_g_rm)}
							</div>
							<div class="wbm-col wbm-col-cost text-right">
								RM ${fmt(r.cost_rm)}
							</div>
							<div class="wbm-col wbm-col-xau text-right">
								${fmt(r.xau_g, 3)} g
							</div>
							<div class="wbm-col wbm-col-xauavco text-right">
								RM ${fmt(xauAvco)}
							</div>
						</div>
					`;
				})
				.join("")
		: `
			<div class="wbm-table-data-row">
				<div class="wbm-col">No data available</div>
			</div>
		`;

	// -----------------------------
	// Main HTML
	// -----------------------------
	const html = `
        <div class="wbm-bag-summary-root">

            <!-- Bag contents table -->
            <div class="wbm-section-header">Bag Contents</div>

            <div class="wbm-bag-card">
                <div class="wbm-table-header-row">
                    <div class="wbm-col wbm-col-purity">PURITY</div>
                    <div class="wbm-col wbm-col-weight text-right">WEIGHT</div>
                    <div class="wbm-col wbm-col-avco text-right">AVCO</div>
                    <div class="wbm-col wbm-col-cost text-right">COST</div>
                    <div class="wbm-col wbm-col-xau text-right">XAU</div>
                    <div class="wbm-col wbm-col-xauavco text-right">XAU AVCO</div>
                </div>

                ${rowsHtml}

                <div class="wbm-table-total-row">
                    <div class="wbm-col wbm-col-purity wbm-total-label">TOTAL</div>
                    <div class="wbm-col wbm-col-weight text-right wbm-total-strong">
                        ${fmt(summary.total_weight_g)} g
                    </div>
                    <div class="wbm-col wbm-col-avco text-right">—</div>
                    <div class="wbm-col wbm-col-cost text-right wbm-total-blue">
                        RM ${fmt(summary.total_cost_basis)}
                    </div>
                    <div class="wbm-col wbm-col-xau text-right wbm-total-strong">
                        ${fmt(summary.pure_gold_xau_g, 3)} g
                    </div>
                    <div class="wbm-col wbm-col-xauavco text-right wbm-total-strong">
                        RM ${fmt(summary.cost_per_gram)}
                    </div>
                </div>
            </div>

            <!-- Summary cards -->
            <div class="wbm-summary-wrapper">
                <div class="wbm-summary-header">Summary</div>

                <div class="wbm-summary-grid">
                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Total Weight</div>
                        <div class="wbm-summary-main">
                            ${fmt(summary.total_weight_g)}
                        </div>
                        <div class="wbm-summary-sub">grams</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Avg Purity</div>
                        <div class="wbm-summary-main">
                            ${fmt(summary.average_purity)}
                        </div>
                        <div class="wbm-summary-sub">percent</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Total XAU</div>
                        <div class="wbm-summary-main">
                            ${fmt(summary.pure_gold_xau_g, 3)}
                        </div>
                        <div class="wbm-summary-sub">grams</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Total Cost</div>
                        <div class="wbm-summary-main">
                            ${fmt(summary.total_cost_basis)}
                        </div>
                        <div class="wbm-summary-sub">ringgit</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">XAU AVCO</div>
                        <div class="wbm-summary-main">
                            ${fmt(summary.cost_per_gram)}
                        </div>
                        <div class="wbm-summary-sub">per gram</div>
                    </div>
                </div>
            </div>

        </div>
    `;

	// -----------------------------
	// Mount
	// -----------------------------
	$mount.html(html);

	// -----------------------------
	// Save hook (future use)
	// -----------------------------
	$(".wbm-save-btn")
		.off("click")
		.on("click", function () {
			if (state.onSaveRecord) {
				state.onSaveRecord();
			}
		});
};
