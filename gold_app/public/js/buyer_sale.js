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
                        <div class="wbs-assay-value" id="wbs-net-weight">—</div>
                    </div>

                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Assay Purity</div>
                        <div class="wbs-assay-value" id="wbs-assay-purity">—</div>
                    </div>

                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Net XAU</div>
                        <div class="wbs-assay-value wbs-blue" id="wbs-net-xau">—</div>
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

                <div id="wbs-table-body"></div>

                <div class="wbs-table-total">
                    <div class="wbs-total-label">TOTAL</div>
                    <div class="wbs-total-val" id="wbs-total-xau">0.00 g</div>
                    <div class="wbs-total-amt" id="wbs-total-amount">RM 0.00</div>
                    <div></div>
                    <div></div>
                </div>
            </div>

            <!-- WARNING -->
            <div class="wbs-warning" style="display:none;"></div>

            <!-- SUMMARY -->
            <div class="wbs-card wbs-summary-card">
                <div class="wbs-card-header">SUMMARY</div>

                <div class="wbs-summary-grid">
                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Total XAU Sold</div>
                        <div class="wbs-summary-value" id="wbs-summary-xau">0.00 g</div>
                    </div>

                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Total Revenue</div>
                        <div class="wbs-summary-value wbs-blue" id="wbs-summary-revenue">
                            RM 0.00
                        </div>
                    </div>

                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Weighted Avg Rate</div>
                        <div class="wbs-summary-value" id="wbs-summary-rate">0.00</div>
                        <div class="wbs-summary-sub">per gram</div>
                    </div>
                </div>
            </div>

        </div>
    `;

	$mount.html(html);

	// --------------------------------------------------
	// HYDRATE FROM ASSAY + LOCKED RATES
	// --------------------------------------------------
	(function hydrateSale() {
		const assay = state.assay || {};
		const sale = state.sale || {};

		$("#wbs-net-weight").text((assay.net_sellable || 0).toFixed(2) + " g");
		$("#wbs-assay-purity").text((assay.assay_purity || 0).toFixed(2) + "%");
		$("#wbs-net-xau").text((assay.net_sellable || 0).toFixed(2) + " g");

		const body = $("#wbs-table-body");
		body.empty();

		if (sale.locked_rates && sale.locked_rates.length) {
			sale.locked_rates.forEach((r) => {
				body.append(createLockedRateRow(r));
			});
		} else {
			body.append(createLockedRateRow());
		}

		updateSaleState();
	})();

	// --------------------------------------------------
	// ROW BUILDER
	// --------------------------------------------------
	function createLockedRateRow(data = {}) {
		return `
			<div class="wbs-table-row">
				<input class="wbs-input" value="${data.price_per_xau || ""}" />
				<input class="wbs-input" value="${data.xau_weight || ""}" />
				<div class="wbs-amount">RM ${(data.amount || 0).toFixed(2)}</div>
				<input class="wbs-input" placeholder="Optional remark" value="${data.remark || ""}" />
				<div class="wbs-trash">🗑</div>
			</div>
		`;
	}

	// --------------------------------------------------
	// PARSE LOCKED RATE TABLE
	// --------------------------------------------------
	function getLockedRates() {
		const rows = [];

		$(".wbs-table-row").each(function () {
			const price = parseFloat($(this).find("input").eq(0).val()) || 0;
			const xauWeight = parseFloat($(this).find("input").eq(1).val()) || 0;
			const remark = $(this).find("input").eq(2).val() || "";

			const amount = price * xauWeight;

			$(this)
				.find(".wbs-amount")
				.text("RM " + amount.toFixed(2));

			rows.push({
				price_per_xau: price,
				xau_weight: xauWeight,
				amount: amount,
				remark: remark,
			});
		});

		return rows;
	}

	// --------------------------------------------------
	// SUMMARY CALCULATION
	// --------------------------------------------------
	function computeSummary(lockedRates) {
		let totalXau = 0;
		let totalRevenue = 0;

		lockedRates.forEach((r) => {
			totalXau += r.xau_weight;
			totalRevenue += r.amount;
		});

		return {
			totalXau,
			totalRevenue,
			weightedAvgRate: totalXau ? totalRevenue / totalXau : 0,
		};
	}

	// --------------------------------------------------
	// UPDATE STATE + UI
	// --------------------------------------------------
	function updateSaleState() {
		const lockedRates = getLockedRates();
		const summary = computeSummary(lockedRates);
		const netXau = state.assay?.net_sellable || 0;

		state.sale = {
			net_weight: netXau,
			assay_purity: state.assay?.assay_purity || 0,
			net_xau: netXau,
			total_xau_sold: summary.totalXau,
			total_revenue: summary.totalRevenue,
			weighted_avg_rate: summary.weightedAvgRate,
			locked_rates: lockedRates,
		};

		$("#wbs-total-xau").text(summary.totalXau.toFixed(2) + " g");
		$("#wbs-total-amount").text(
			"RM " +
				summary.totalRevenue.toLocaleString("en-MY", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})
		);

		$("#wbs-summary-xau").text(summary.totalXau.toFixed(2) + " g");
		$("#wbs-summary-revenue").text(
			"RM " +
				summary.totalRevenue.toLocaleString("en-MY", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})
		);
		$("#wbs-summary-rate").text(summary.weightedAvgRate.toFixed(2));

		if (summary.totalXau > netXau) {
			$(".wbs-warning")
				.show()
				.html(
					`⚠ Mismatch: Table shows <b>${summary.totalXau.toFixed(
						2
					)} g</b> but Net XAU is <b>${netXau.toFixed(2)} g</b>`
				);
		} else {
			$(".wbs-warning").hide();
		}
	}

	// --------------------------------------------------
	// EVENTS
	// --------------------------------------------------
	$(document).on("input", ".wbs-table-row input", updateSaleState);

	$(document).on("click", ".wbs-trash", function () {
		$(this).closest(".wbs-table-row").remove();
		updateSaleState();
	});
	$(document)
		.off("click", ".wbs-add-btn")
		.on("click", ".wbs-add-btn", function () {
			$("#wbs-table-body").append(createLockedRateRow());
		});
};
