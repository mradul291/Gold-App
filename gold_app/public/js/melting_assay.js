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
                            <input type="text" class="wbm-input" value="300" />
                            <span class="wbm-input-suffix">grams</span>
                        </div>
                    </div>

                    <div class="wbm-field-block">
                        <div class="wbm-field-label">Weight After Melting</div>
                        <div class="wbm-input-wrapper">
                            <input type="text" class="wbm-input" value="295" />
                            <span class="wbm-input-suffix">grams</span>
                        </div>
                    </div>
                </div>

                <div class="wbm-melt-row">
                    <div class="wbm-field-block wbm-field-block--wide">
                        <div class="wbm-field-label">Melting Cost</div>
                        <div class="wbm-input-wrapper">
                            <input type="text" class="wbm-input" value="150" />
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
                        <div class="wbm-loss-main wbm-loss-main--red">5.00 g</div>
                    </div>
                    <div class="wbm-loss-item">
                        <div class="wbm-loss-label">XAU Loss</div>
                        <div class="wbm-loss-main">19.44 g</div>
                    </div>
                    <div class="wbm-loss-item">
                        <div class="wbm-loss-label">Loss Percentage</div>
                        <div class="wbm-loss-main wbm-loss-main--red">1.67%</div>
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

	// hook state / events later if needed
};
