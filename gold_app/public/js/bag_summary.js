window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.bag_summary = function ($mount, state) {
	// static demo data to match reference UI
	const rows = [
		{
			purity: "9999",
			weight: "100.00 g",
			avco: "RM 90.00",
			cost: "RM 9,000.00",
			xau: "999.90 g",
			xau_avco: "RM 9.00",
		},
		{
			purity: "916",
			weight: "100.00 g",
			avco: "RM 80.00",
			cost: "RM 8,000.00",
			xau: "91.60 g",
			xau_avco: "RM 87.34",
		},
		{
			purity: "750",
			weight: "100.00 g",
			avco: "RM 65.00",
			cost: "RM 6,500.00",
			xau: "75.00 g",
			xau_avco: "RM 86.67",
		},
	];

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

                ${rows
					.map(
						(r) => `
                    <div class="wbm-table-data-row">
                        <div class="wbm-col wbm-col-purity">
                            <span class="wbm-pill">${r.purity}</span>
                        </div>
                        <div class="wbm-col wbm-col-weight text-right">${r.weight}</div>
                        <div class="wbm-col wbm-col-avco text-right">${r.avco}</div>
                        <div class="wbm-col wbm-col-cost text-right">${r.cost}</div>
                        <div class="wbm-col wbm-col-xau text-right">${r.xau}</div>
                        <div class="wbm-col wbm-col-xauavco text-right">${r.xau_avco}</div>
                    </div>
                `
					)
					.join("")}

                <div class="wbm-table-total-row">
                    <div class="wbm-col wbm-col-purity wbm-total-label">TOTAL</div>
                    <div class="wbm-col wbm-col-weight text-right wbm-total-strong">300.00 g</div>
                    <div class="wbm-col wbm-col-avco text-right">—</div>
                    <div class="wbm-col wbm-col-cost text-right wbm-total-blue">RM 23,500.00</div>
                    <div class="wbm-col wbm-col-xau text-right wbm-total-strong">1166.50 g</div>
                    <div class="wbm-col wbm-col-xauavco text-right wbm-total-strong">RM 20.15</div>
                </div>
            </div>

            <!-- Summary cards -->
            <div class="wbm-summary-wrapper">
                <div class="wbm-summary-header">Summary</div>

                <div class="wbm-summary-grid">
                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Total Weight</div>
                        <div class="wbm-summary-main">300.00</div>
                        <div class="wbm-summary-sub">grams</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Avg Purity</div>
                        <div class="wbm-summary-main">388.83</div>
                        <div class="wbm-summary-sub">percent</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Total XAU</div>
                        <div class="wbm-summary-main">1166.50</div>
                        <div class="wbm-summary-sub">grams</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">Total Cost</div>
                        <div class="wbm-summary-main">23,500</div>
                        <div class="wbm-summary-sub">ringgit</div>
                    </div>

                    <div class="wbm-summary-card">
                        <div class="wbm-summary-label">XAU AVCO</div>
                        <div class="wbm-summary-main">20.15</div>
                        <div class="wbm-summary-sub">per gram</div>
                    </div>
                </div>
            </div>

            <div class="wbm-main-footer">
                <button class="btn btn-default wbm-back-btn">← Back to Bags</button>
            </div>
        </div>
    `;

	$mount.html(html);

	$mount.find(".wbm-back-btn").on("click", function () {
		if (state.onBackToBags) state.onBackToBags();
	});

	$(".wbm-save-btn")
		.off("click")
		.on("click", function () {
			if (state.onSaveRecord) state.onSaveRecord();
		});
};
