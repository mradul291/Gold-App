window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.buyer_sale = function ($mount, state) {
	const html = `
        <div class="wbs-root">

            <!-- Title -->
            <div class="wbs-title">Sales Detail</div>

            <!-- FROM ASSAY SECTION -->
            <div class="wbs-card wbs-assay-card">
                <div class="wbs-card-header">FROM ASSAY SECTION</div>

                <div class="wbs-assay-grid">
                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Net Weight</div>
                        <div class="wbs-assay-value">293.00 g</div>
                    </div>

                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Assay Purity</div>
                        <div class="wbs-assay-value">92.50%</div>
                    </div>

                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Net XAU</div>
                        <div class="wbs-assay-value wbs-blue">271.02 g</div>
                    </div>
                </div>
            </div>

            <!-- LOCKED RATES -->
            <div class="wbs-section-head">
                <div class="wbs-section-title">Locked Rates</div>
                <button class="wbs-add-btn">+ Add Rate</button>
            </div>

            <div class="wbs-card">
                <div class="wbs-table-head">
                    <div>PRICE PER XAU</div>
                    <div>XAU WEIGHT</div>
                    <div>AMOUNT</div>
                    <div>REMARK</div>
                    <div></div>
                </div>

                <!-- ROW -->
                <div class="wbs-table-row">
                    <input class="wbs-input" value="562.05"/>
                    <input class="wbs-input" value="362.844"/>
                    <div class="wbs-amount">RM 203,936.47</div>
                    <input class="wbs-input" placeholder="Optional remark"/>
                    <div class="wbs-trash">🗑</div>
                </div>

                <div class="wbs-table-row">
                    <input class="wbs-input" value="558.88"/>
                    <input class="wbs-input" value="460"/>
                    <div class="wbs-amount">RM 257,084.80</div>
                    <input class="wbs-input" placeholder="Optional remark"/>
                    <div class="wbs-trash">🗑</div>
                </div>

                <div class="wbs-table-row">
                    <input class="wbs-input" value="558.45"/>
                    <input class="wbs-input" value="88.937"/>
                    <div class="wbs-amount">RM 49,666.87</div>
                    <input class="wbs-input" placeholder="Optional remark"/>
                    <div class="wbs-trash">🗑</div>
                </div>

                <!-- TOTAL -->
                <div class="wbs-table-total">
                    <div class="wbs-total-label">TOTAL</div>
                    <div class="wbs-total-val">911.78 g</div>
                    <div class="wbs-total-amt">RM 510,688.14</div>
                    <div></div>
                    <div></div>
                </div>
            </div>
    
            <!-- WARNING -->
            <div class="wbs-warning">
                ⚠ Mismatch: Table shows <b>911.78 g</b> but Net XAU is <b>271.02 g</b>
            </div>

            <!-- SUMMARY -->
            <div class="wbs-card wbs-summary-card">
                <div class="wbs-card-header">SUMMARY</div>

                <div class="wbs-summary-grid">
                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Total XAU Sold</div>
                        <div class="wbs-summary-value">911.78 g</div>
                    </div>

                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Total Revenue</div>
                        <div class="wbs-summary-value wbs-blue">RM 510,688.14</div>
                    </div>

                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Weighted Avg Rate</div>
                        <div class="wbs-summary-value">RM 560.10</div>
                        <div class="wbs-summary-sub">per gram</div>
                    </div>
                </div>
            </div>

        </div>
    `;

	$mount.html(html);
};
