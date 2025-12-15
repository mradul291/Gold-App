window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.melting_assay = function ($mount, state) {
	const html = `
        <div class="wbm-melt-root">
            <!-- Melting Details -->
            <div class="wbm-section-title">Melting Details</div>

            <div class="wbm-card wbm-melt-card">
                <div class="wbm-melt-row wbm-melt-row--two">
                    <div class="wbm-field-block">
                        <div class="wbm-field-label">Weight Before Melting</div>
                        <div class="wbm-input-wrapper">
                            <input id="melt-before" type="text" class="wbm-input" readonly />
                            <span class="wbm-input-suffix">grams</span>
                        </div>
                    </div>

                    <div class="wbm-field-block">
                        <div class="wbm-field-label">Weight After Melting</div>
                        <div class="wbm-input-wrapper">
                            <input id="melt-after" type="text" class="wbm-input" value="" />
                            <span class="wbm-input-suffix">grams</span>
                        </div>
                    </div>
                </div>

                <div class="wbm-melt-row">
                    <div class="wbm-field-block wbm-field-block--wide">
                        <div class="wbm-field-label">Melting Cost</div>
                        <div class="wbm-input-wrapper">
                            <input id="melt-cost" type="text" class="wbm-input" value="" />
                            <span class="wbm-input-suffix">RM</span>
                        </div>
                    </div>

                    <div class="wbm-payment-group">
                        <label class="wbm-radio-label">
                            <input type="radio" name="melt_payment_mode" checked />
                            <span class="wbm-radio-display"></span>
                            <span class="wbm-radio-text">Cash</span>
                        </label>
                        <label class="wbm-radio-label">
                            <input type="radio" name="melt_payment_mode" />
                            <span class="wbm-radio-display"></span>
                            <span class="wbm-radio-text">Transfer</span>
                        </label>
                    </div>
                </div>

                <div class="wbm-loss-strip">
                    <div class="wbm-loss-item">
                        <div class="wbm-loss-label">Weight Loss</div>
                        <div id="loss-weight" class="wbm-loss-main wbm-loss-main--red">0.00 g</div>
                    </div>
                    <div class="wbm-loss-item">
                        <div class="wbm-loss-label">XAU Loss</div>
                        <div id="loss-xau" class="wbm-loss-main">0.00 g</div>
                    </div>
                    <div class="wbm-loss-item">
                        <div class="wbm-loss-label">Loss Percentage</div>
                        <div id="loss-percent" class="wbm-loss-main wbm-loss-main--red">0.00%</div>
                    </div>
                </div>
            </div>

            <!-- Assay Results -->
            <div class="wbm-section-title wbm-assay-title">Assay Results</div>

            <div class="wbm-card wbm-assay-card">
                <!-- row 1 -->
                <div class="wbm-assay-row">
                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">Current Avg Purity</div>
                        <div class="wbm-assay-box wbm-assay-box--neutral">
                            <span id="assay-current-purity" class="wbm-assay-value">—</span>
                        </div>
                    </div>

                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label wbm-assay-label--right">
                            Assay Purity
                            <span class="wbm-assay-label-suffix">%</span>
                        </div>
                        <div class="wbm-input-wrapper wbm-assay-input-wrapper">
                            <input type="text" class="wbm-input wbm-input--right" value="" />
                        </div>
                    </div>
                </div>

                <!-- row 2 -->
                <div class="wbm-assay-row">
                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">Purity Variance</div>
                        <div class="wbm-assay-box wbm-assay-box--danger">
                            <span id="assay-purity-variance" class="wbm-assay-value wbm-assay-value--danger">—</span>
                        </div>
                    </div>

                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">XAU Weight Variance</div>
                        <div class="wbm-assay-box wbm-assay-box--danger">
                            <span id="assay-xau-variance" class="wbm-assay-value wbm-assay-value--danger">—</span>
                        </div>
                    </div>
                </div>

                <!-- row 3 -->
                <div class="wbm-assay-row">
                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">Actual XAU Weight</div>
                        <div class="wbm-assay-box wbm-assay-box--info">
                            <span id="assay-actual-xau" class="wbm-assay-value wbm-assay-value--link">—</span>
                        </div>
                    </div>

                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label wbm-assay-label--right">
                            Assay Sample Weight
                            <span class="wbm-assay-label-suffix">grams</span>
                        </div>
                        <div class="wbm-input-wrapper wbm-assay-input-wrapper">
                            <input type="text" class="wbm-input wbm-input--right" value="" />
                        </div>
                    </div>
                </div>

                <!-- net xau strip -->
                <div class="wbm-assay-net-strip">
                    <div class="wbm-assay-net-label">Net XAU (Sellable)</div>
                    <div class="wbm-assay-net-value">271.02 g</div>
                </div>

                <!-- assay cost row -->
                <div class="wbm-assay-cost-row">
                    <div class="wbm-field-block wbm-field-block--wide">
                        <div class="wbm-field-label">Assay Cost</div>
                        <div class="wbm-input-wrapper">
                            <input type="text" class="wbm-input" value="" />
                            <span class="wbm-input-suffix">RM</span>
                        </div>
                    </div>

                    <div class="wbm-payment-group">
                        <label class="wbm-radio-label">
                            <input type="radio" name="assay_payment_mode" />
                            <span class="wbm-radio-display"></span>
                            <span class="wbm-radio-text">Cash</span>
                        </label>
                        <label class="wbm-radio-label">
                            <input type="radio" name="assay_payment_mode" checked />
                            <span class="wbm-radio-display"></span>
                            <span class="wbm-radio-text">Transfer</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;

	$mount.html(html);

	(function hydrateMeltingAssay() {
		const m = state.melting || {};
		const a = state.assay || {};

		// MELTING
		if (m.before !== undefined) $("#melt-before").val(m.before);
		if (m.after !== undefined) $("#melt-after").val(m.after);
		if (m.cost !== undefined) $("#melt-cost").val(m.cost);

		if (m.payment_mode) {
			$('input[name="melt_payment_mode"]').each(function () {
				const label = $(this).parent().text().trim();
				this.checked = label === m.payment_mode;
			});
		}

		// ASSAY
		const assayInputs = $(".wbm-assay-input-wrapper input");
		if (a.assay_purity !== undefined) assayInputs.eq(0).val(a.assay_purity);
		if (a.assay_sample_weight !== undefined) assayInputs.eq(1).val(a.assay_sample_weight);
		if (a.cost !== undefined) $(".wbm-assay-cost-row input").val(a.cost);

		if (a.payment_mode) {
			$('input[name="assay_payment_mode"]').each(function () {
				const label = $(this).parent().text().trim();
				this.checked = label === a.payment_mode;
			});
		}
		// -----------------------------
		// Restore computed melting values immediately
		// -----------------------------
		if (state.melting) {
			const m = state.melting;

			if (m.weight_loss !== undefined)
				$("#loss-weight").text(m.weight_loss.toFixed(2) + " g");

			if (m.xau_loss !== undefined) $("#loss-xau").text(m.xau_loss.toFixed(2) + " g");

			if (m.loss_percentage !== undefined)
				$("#loss-percent").text(m.loss_percentage.toFixed(2) + "%");
		}

		if (state.assay) {
			$("#assay-current-purity").text(state.assay.current_purity?.toFixed(2) + "%");
			$(".wbm-assay-net-value").text(state.assay.net_sellable?.toFixed(2) + " g");
		}

		// Trigger calculations to refresh computed UI
		$("#melt-after").trigger("input");
		assayInputs.trigger("input");
	})();

	// REALTIME MELTING CALCULATIONS
	const summary = state.bag_summary || {};
	const before = summary.total_weight_g || 0;
	const avgPurity = calcCurrentAvgPurity();

	const avgPurityMillesimal = avgPurity * 10; // 75% → 750

	// Set initial value
	$("#melt-before").val(before);

	// Attach listener to Weight After Melting
	$(document).on("input", "#melt-after", function () {
		const after = parseFloat($(this).val()) || 0;

		// Weight Loss
		const weightLoss = before - after;

		// XAU Before
		const xauBefore = state.bag_summary?.pure_gold_xau_g || 0;

		// XAU After
		const xauAfter = after * (avgPurityMillesimal / 1000);

		// XAU Loss
		const xauLoss = xauBefore - xauAfter;

		// Loss %
		const lossPct = before > 0 ? (weightLoss / before) * 100 : 0;

		// Update UI values
		$("#loss-weight").text(weightLoss.toFixed(2) + " g");
		$("#loss-xau").text(xauLoss.toFixed(2) + " g");
		$("#loss-percent").text(lossPct.toFixed(2) + "%");
	});

	function calcCurrentAvgPurity() {
		const totalWeight = state.bag_summary?.total_weight_g || 0;
		const totalXau = state.bag_summary?.pure_gold_xau_g || 0;
		return totalWeight ? (totalXau / totalWeight) * 100 : 0;
	}

	const currentAvgPurity = calcCurrentAvgPurity();
	$("#assay-current-purity").text(currentAvgPurity.toFixed(2) + "%");

	//--------------------------------------------------
	// STORE REALTIME MELTING VALUES INTO STATE
	//--------------------------------------------------
	function updateMeltingState() {
		const beforeVal = parseFloat($("#melt-before").val()) || 0;
		const afterVal = parseFloat($("#melt-after").val()) || 0;
		const costVal = parseFloat($("#melt-cost").val()) || 0;

		const weightLoss = beforeVal - afterVal;
		const xauBefore = state.bag_summary?.pure_gold_xau_g || 0;
		const avgPurityMillesimal = avgPurity * 10;
		const xauAfter = afterVal * (avgPurityMillesimal / 1000);
		const xauLoss = xauBefore - xauAfter;

		const lossPct = beforeVal ? (weightLoss / beforeVal) * 100 : 0;

		const paymentMode = $('input[name="melt_payment_mode"]:checked').parent().text().trim();

		state.melting = {
			before: beforeVal,
			after: afterVal,
			cost: costVal,
			payment_mode: paymentMode,
			weight_loss: weightLoss,
			xau_loss: xauLoss,
			loss_percentage: lossPct,
		};
	}

	// Trigger state update on input changes
	$(document).on("input", "#melt-after", updateMeltingState);
	$(document).on("input", "#melt-cost", updateMeltingState);
	$(document).on("change", 'input[name="melt_payment_mode"]', updateMeltingState);

	// Initialize once
	updateMeltingState();

	//--------------------------------------------------
	// STORE ASSAY VALUES INTO STATE
	//--------------------------------------------------
	function updateAssayState() {
		const afterMelting = state.melting?.after || 0;
		const totalCost = state.bag_summary?.total_cost_basis || 0;

		const currentAvgPurity = calcCurrentAvgPurity();
		const assayPurity = parseFloat($(".wbm-assay-input-wrapper input").eq(0).val()) || 0;
		const sampleWeight = parseFloat($(".wbm-assay-input-wrapper input").eq(1).val()) || 0;

		// XAU calculations
		const expectedXau = afterMelting * (currentAvgPurity / 100);
		const actualXau = afterMelting * (assayPurity / 100);

		const purityVariance = assayPurity - currentAvgPurity;
		const xauVariance = actualXau - expectedXau;

		// Sample deduction (CORRECT LOGIC)
		const sampleXau = sampleWeight * (assayPurity / 100);
		const netSellableXau = actualXau - sampleXau;

		// AVCO after melting
		const avcoAfterMelting = afterMelting ? totalCost / afterMelting : 0;

		const sampleCost = sampleWeight * avcoAfterMelting;

		const assayCost = parseFloat($(".wbm-assay-cost-row input").val()) || 0;
		const assayPaymentMode = $('input[name="assay_payment_mode"]:checked')
			.parent()
			.text()
			.trim();

		// ---- Update UI ----
		$("#assay-purity-variance").text(purityVariance.toFixed(2) + "%");
		$("#assay-xau-variance").text(xauVariance.toFixed(2) + " g");
		$("#assay-actual-xau").text(actualXau.toFixed(2) + " g");

		$(".wbm-assay-net-value").text(netSellableXau.toFixed(2) + " g");

		// ---- Store to state ----
		state.assay = {
			current_purity: currentAvgPurity,
			assay_purity: assayPurity,
			purity_variance: purityVariance,
			xau_weight_variance: xauVariance,
			actual_xau_weight: actualXau,
			assay_sample_weight: sampleWeight,
			net_sellable: netSellableXau,

			// cost related (important for backend & future bag move)
			avco_after_melting: avcoAfterMelting,
			sample_cost: sampleCost,

			cost: assayCost,
			payment_mode: assayPaymentMode,
		};
	}

	// Trigger updates
	$(document).on("input", ".wbm-assay-input-wrapper input", updateAssayState);
	$(document).on("input", ".wbm-assay-cost-row input", updateAssayState);
	$(document).on("change", 'input[name="assay_payment_mode"]', updateAssayState);

	// Initialize once
	updateAssayState();
};
