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
                            <span class="wbm-assay-value">388.83%</span>
                        </div>
                    </div>

                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label wbm-assay-label--right">
                            Assay Purity
                            <span class="wbm-assay-label-suffix">%</span>
                        </div>
                        <div class="wbm-input-wrapper wbm-assay-input-wrapper">
                            <input type="text" class="wbm-input wbm-input--right" value="92.5" />
                        </div>
                    </div>
                </div>

                <!-- row 2 -->
                <div class="wbm-assay-row">
                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">Purity Variance</div>
                        <div class="wbm-assay-box wbm-assay-box--danger">
                            <span class="wbm-assay-value wbm-assay-value--danger">-296.33%</span>
                        </div>
                    </div>

                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">XAU Weight Variance</div>
                        <div class="wbm-assay-box wbm-assay-box--danger">
                            <span class="wbm-assay-value wbm-assay-value--danger">-874.18 g</span>
                        </div>
                    </div>
                </div>

                <!-- row 3 -->
                <div class="wbm-assay-row">
                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label">Actual XAU Weight</div>
                        <div class="wbm-assay-box wbm-assay-box--info">
                            <span class="wbm-assay-value wbm-assay-value--link">272.88 g</span>
                        </div>
                    </div>

                    <div class="wbm-assay-field">
                        <div class="wbm-assay-label wbm-assay-label--right">
                            Assay Sample Weight
                            <span class="wbm-assay-label-suffix">grams</span>
                        </div>
                        <div class="wbm-input-wrapper wbm-assay-input-wrapper">
                            <input type="text" class="wbm-input wbm-input--right" value="2" />
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
                            <input type="text" class="wbm-input" value="100" />
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

	// REALTIME MELTING CALCULATIONS
	const summary = state.bag_summary || {};
	const before = summary.total_weight_g || 0;
	const avgPurity = summary.average_purity || 0;

	// Set initial value
	$("#melt-before").val(before);

	// Attach listener to Weight After Melting
	$(document).on("input", "#melt-after", function () {
		const after = parseFloat($(this).val()) || 0;

		// Weight Loss
		const weightLoss = before - after;

		// XAU Before = WeightBefore * (purity/1000)
		const xauBefore = before * (avgPurity / 1000);

		// XAU After = WeightAfter * (purity/1000)
		const xauAfter = after * (avgPurity / 1000);

		// XAU Loss
		const xauLoss = xauBefore - xauAfter;

		// Loss %
		const lossPct = before > 0 ? (weightLoss / before) * 100 : 0;

		// Update UI values
		$("#loss-weight").text(weightLoss.toFixed(2) + " g");
		$("#loss-xau").text(xauLoss.toFixed(2) + " g");
		$("#loss-percent").text(lossPct.toFixed(2) + "%");
	});

	// CAPTURE MELTING COST
	$(document).on("input", "#melt-cost", function () {
		const meltCost = parseFloat($(this).val()) || 0;
		state.melting_cost = meltCost;
	});

	//--------------------------------------------------
	// STORE REALTIME MELTING VALUES INTO STATE
	//--------------------------------------------------
	function updateMeltingState() {
		const beforeVal = parseFloat($("#melt-before").val()) || 0;
		const afterVal = parseFloat($("#melt-after").val()) || 0;
		const costVal = parseFloat($("#melt-cost").val()) || 0;

		const weightLoss = beforeVal - afterVal;
		const xauLoss = weightLoss * (avgPurity / 1000);
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
		const assayPurity = parseFloat($(".wbm-assay-input-wrapper input").eq(0).val()) || 0;
		const sampleWeight = parseFloat($(".wbm-assay-input-wrapper input").eq(1).val()) || 0;

		const purityVariance = assayPurity - avgPurity;
		const actualXau = before * (assayPurity / 1000);
		const expectedXau = before * (avgPurity / 1000);
		const xauVariance = actualXau - expectedXau;
		const netSellable = actualXau - sampleWeight;

		const assayCost = parseFloat($(".wbm-assay-cost-row input").val()) || 0;
		const assayPaymentMode = $('input[name="assay_payment_mode"]:checked')
			.parent()
			.text()
			.trim();

		state.assay = {
			current_purity: avgPurity,
			assay_purity: assayPurity,
			purity_variance: purityVariance,
			xau_weight_variance: xauVariance,
			actual_xau_weight: actualXau,
			assay_sample_weight: sampleWeight,
			net_sellable: netSellable,
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
