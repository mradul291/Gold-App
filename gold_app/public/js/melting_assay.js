// public/js/melting_assay.js

window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.melting_assay = function ($mount, state) {
	const data = state.melting_assay || {
		pre_melt_weight: 740,
		post_melt_weight: "",
		weight_loss_g: "",
		weight_loss_pct: "",
		melting_cost_rm: "",
		melting_date: "",
		est_purity_from_bag: state.bag_summary?.average_purity || 903.5,
		purity_variance: "",
		actual_purity: "",
		actual_xau_g: "",
		assay_cost_rm: "",
		assay_date: "",
		refine_to_9999: false,
		target_purity: 999.9,
		post_refining_weight: "",
		refining_cost_rm: "",
		refining_date: "",
	};

	const formatNumber = (val, decimals) => {
		if (val === null || val === undefined || val === "") return "";
		const n = typeof val === "number" ? val : parseFloat(String(val));
		return n.toLocaleString("en-MY", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	};

	const html = `
        <div>

            <!-- MELTING DETAILS -->
            <div class="ma-section-header">
                <span>MELTING DETAILS</span>
            </div>

            <div class="ma-section-card">
                <div class="ma-two-col">

                    <!-- Left column -->
                    <div class="ma-col">
                        <div class="ma-field">
                            <label>Pre-Melt Weight (g)</label>
                            <input type="text" class="ma-input" value="${formatNumber(
								data.pre_melt_weight,
								2
							)}" readonly>
                        </div>

                        <div class="ma-field">
                            <label>Weight Loss (g)</label>
                            <input type="text" class="ma-input ma-input-readonly" placeholder="Auto-calculated" readonly>
                        </div>

                        <div class="ma-field">
                            <label>Melting Cost (RM)</label>
                            <input type="text" class="ma-input" placeholder="Enter melting cost">
                        </div>
                    </div>

                    <!-- Right column -->
                    <div class="ma-col">
                        <div class="ma-field">
                            <label>Post-Melt Weight (g)</label>
                            <input type="text" class="ma-input" placeholder="Enter post-melt weight">
                        </div>

                        <div class="ma-field">
                            <label>Weight Loss (%)</label>
                            <input type="text" class="ma-input ma-input-readonly" placeholder="Auto-calculated" readonly>
                        </div>

                        <div class="ma-field ma-field-inline">
                            <div class="ma-field-full">
                                <label>Melting Date</label>
                                <input type="text" class="ma-input" placeholder="mm/dd/yyyy">
                            </div>
                            <div class="ma-date-icon">
                                <i class="fa fa-calendar"></i>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- ASSAY DETAILS -->
            <div class="ma-section-header ma-section-header-spacing">
                <span>ASSAY DETAILS</span>
            </div>

            <div class="ma-section-card">
                <div class="ma-two-col">

                    <!-- Left column -->
                    <div class="ma-col">
                        <div class="ma-field">
                            <label>Estimated Purity (from bag)</label>
                            <input type="text" class="ma-input" value="${formatNumber(
								data.est_purity_from_bag,
								1
							)}" readonly>
                        </div>

                        <div class="ma-field">
                            <label>Purity Variance (± difference)</label>
                            <input type="text" class="ma-input ma-input-readonly" placeholder="Auto-calculated" readonly>
                        </div>

                        <div class="ma-field">
                            <label>Assay Cost (RM)</label>
                            <input type="text" class="ma-input" placeholder="Enter assay cost">
                        </div>
                    </div>

                    <!-- Right column -->
                    <div class="ma-col">
                        <div class="ma-field">
                            <label>Actual Purity (from Assay)</label>
                            <input type="text" class="ma-input" placeholder="Enter actual purity">
                        </div>

                        <div class="ma-field">
                            <label>Actual XAU (g)</label>
                            <input type="text" class="ma-input ma-input-readonly" placeholder="Auto-calculated" readonly>
                        </div>

                        <div class="ma-field ma-field-inline">
                            <div class="ma-field-full">
                                <label>Assay Date</label>
                                <input type="text" class="ma-input" placeholder="mm/dd/yyyy">
                            </div>
                            <div class="ma-date-icon">
                                <i class="fa fa-calendar"></i>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- REFINING (Optional) -->
            <div class="ma-section-header ma-section-header-spacing">
                <span>REFINING (Optional)</span>
            </div>

            <div class="ma-refine-toggle">
                <label class="ma-checkbox-label">
                    <input type="checkbox" class="ma-checkbox">
                    <span>Refine to 999.9 Purity</span>
                </label>
            </div>

            <div class="ma-section-card">
                <div class="ma-two-col">

                    <!-- Left column -->
                    <div class="ma-col">
                        <div class="ma-field">
                            <label>Target Purity</label>
                            <input type="text" class="ma-input" value="${formatNumber(
								data.target_purity,
								1
							)}">
                        </div>

                        <div class="ma-field">
                            <label>Refining Cost (RM)</label>
                            <input type="text" class="ma-input" placeholder="Enter refining cost">
                        </div>
                    </div>

                    <!-- Right column -->
                    <div class="ma-col">
                        <div class="ma-field">
                            <label>Post-Refining Weight (g)</label>
                            <input type="text" class="ma-input" placeholder="If weight changes">
                        </div>

                        <div class="ma-field ma-field-inline">
                            <div class="ma-field-full">
                                <label>Refining Date</label>
                                <input type="text" class="ma-input" placeholder="mm/dd/yyyy">
                            </div>
                            <div class="ma-date-icon">
                                <i class="fa fa-calendar"></i>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
			 <div class="ma-footer-bar">
                <button class="btn btn-default wbm-back-btn">← Back to Bags</button>
            </div>
        </div>
    `;

	$mount.html(html);

	// Back button handler
	$mount.find(".wbm-back-btn").on("click", function () {
		if (state.onBackToBags) state.onBackToBags();
	});

	// (Optional) keep global SAVE wiring
	$(".wbm-save-btn")
		.off("click")
		.on("click", function () {
			if (state.onSaveRecord) state.onSaveRecord();
		});
};
