// public/js/buyer_sale.js

window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.buyer_sale = function ($mount, state) {
	const sale = state.buyer_sale || {
		buyer: "",
		contact: "Auto-filled",
		final_weight_g: 725.0,
		final_purity: 905.2,
		final_xau_g: 656.27,
		locked_rate_rm_per_xau: "",
		gross_sale_value_rm: "",
		payment_term: "Net 30 Days",
		payments: [
			{
				date: "10/11/2024",
				type: "Advance",
				amount_rm: 20000.0,
				reference: "ADV-001",
			},
		],
		total_paid_rm: 20000.0,
		balance_due_rm: null,
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
        <div>

            <!-- BUYER INFORMATION -->
            <div class="bs-section-header">
                <span>BUYER INFORMATION</span>
            </div>

            <div class="bs-section-card bs-section-card-full">
                <div class="bs-two-col">
                    <div class="bs-col">
                        <div class="bs-field">
                            <label>Buyer</label>
                            <select class="bs-input bs-select">
                                <option value="">Select Buyer</option>
                            </select>
                        </div>
                    </div>

                    <div class="bs-col">
                        <div class="bs-field">
                            <label>Contact</label>
                            <input type="text" class="bs-input bs-input-readonly" value="${
								sale.contact
							}" readonly>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SALE DETAILS -->
            <div class="bs-section-header bs-section-header-spacing">
                <span>SALE DETAILS</span>
            </div>

            <div class="bs-section-card">
                <!-- First row -->
                <div class="bs-two-col">
                    <div class="bs-col">
                        <div class="bs-field">
                            <label>Final Weight (g)</label>
                            <input type="text" class="bs-input" value="${formatNumber(
								sale.final_weight_g,
								2
							)}" readonly>
                        </div>
                    </div>

                    <div class="bs-col">
                        <div class="bs-field">
                            <label>Final Purity</label>
                            <input type="text" class="bs-input" value="${formatNumber(
								sale.final_purity,
								1
							)}" readonly>
                        </div>
                    </div>
                </div>

                <!-- Second row -->
                <div class="bs-two-col">
                    <div class="bs-col">
                        <div class="bs-field">
                            <label>Final XAU (g)</label>
                            <input type="text" class="bs-input bs-input-readonly" value="${formatNumber(
								sale.final_xau_g,
								2
							)}" readonly>
                        </div>
                    </div>

                    <div class="bs-col">
                        <div class="bs-field">
                            <label>Locked Rate (RM/g XAU)</label>
                            <input type="text" class="bs-input" placeholder="Enter locked rate">
                        </div>
                    </div>
                </div>

                <!-- Third row: Gross Sale Value -->
                <div class="bs-one-col">
                    <div class="bs-field">
                        <label>Gross Sale Value (RM)</label>
                        <input type="text" class="bs-input" placeholder="Auto: XAU × Rate">
                    </div>
                </div>
            </div>

            <!-- PAYMENT DETAILS -->
            <div class="bs-section-header bs-section-header-spacing">
                <span>PAYMENT DETAILS</span>
            </div>

            <div class="bs-section-card">
                <!-- Payment term -->
                <div class="bs-field">
                    <label>Payment Term</label>
                    <select class="bs-input bs-select">
                        <option value="net30">${sale.payment_term}</option>
                    </select>
                </div>

                <!-- Payment table -->
                <div class="bs-payment-table">
                    <table class="table bs-pay-table">
                        <thead>
                            <tr>
                                <th>DATE</th>
                                <th>TYPE</th>
                                <th>AMOUNT (RM)</th>
                                <th>REFERENCE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.payments
								.map(
									(p) => `
                                    <tr>
                                        <td>${p.date}</td>
                                        <td>${p.type}</td>
                                        <td>${formatRM(p.amount_rm)}</td>
                                        <td>${p.reference}</td>
                                    </tr>
                                `
								)
								.join("")}
                        </tbody>
                    </table>
                </div>

                <button class="btn btn-primary bs-add-payment-btn">+ Add Payment</button>
            </div>

            <!-- Payment summary bar -->
            <div class="bs-summary-bar">
                <div class="bs-summary-left">
                    <div class="bs-summary-label">Total Paid</div>
                    <div class="bs-summary-value">${formatRM(sale.total_paid_rm)}</div>
                </div>
                <div class="bs-summary-right">
                    <div class="bs-summary-label">Balance Due</div>
                    <div class="bs-summary-value">
                        ${sale.balance_due_rm == null ? "RM—,--" : formatRM(sale.balance_due_rm)}
                    </div>
                </div>
            </div>

            <!-- Back to Bags button -->
            <div class="bs-footer-bar">
                <button class="btn btn-default wbm-back-btn">← Back to Bags</button>
            </div>

        </div>
    `;

	$mount.html(html);

	// Back button handler
	$mount.find(".wbm-back-btn").on("click", function () {
		if (state.onBackToBags) state.onBackToBags();
	});

	// Optional: SAVE handler scoped to this tab
	$(".wbm-save-btn")
		.off("click.buyer_sale")
		.on("click.buyer_sale", function () {
			if (state.onSaveRecord) state.onSaveRecord();
		});
};
