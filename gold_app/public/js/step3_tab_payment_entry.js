class Step3TabPaymentEntry {
	constructor(props, container, submitCallback) {
		this.props = props || {};
		this.container = container;
		this.submitCallback = submitCallback;
		this.render();
		this.attachHandlers();
	}

	render() {
		this.container.html(`
			<div class="payment-entry-section mt-4">
				<h4 class="section-title mb-3">Payment Entry Section</h4>
				<div class="form-group mb-3">
					<label for="payment-method" class="form-label fw-bold">Select Payment Method</label>
					<select id="payment-method" class="form-select">
						<option value="Cash" selected>Cash</option>
						<option value="Bank Transfer">Bank Transfer</option>
						<option value="Mix">Mix</option>
					</select>
				</div>
				<div class="text-end">
					<button id="submit-payment" class="btn btn-primary mt-3">Submit Payment</button>
				</div>
			</div>
		`);
	}

	attachHandlers() {
		const container = this.container;

		// Optional: alert on method change
		container
			.find("#payment-method")
			.off("change")
			.on("change", function () {
				const selected = $(this).val();
				frappe.show_alert({
					message: `Selected Payment Method: ${selected}`,
					indicator: "blue",
				});
			});

		// Submit Payment button click
		container
			.find("#submit-payment")
			.off("click")
			.on("click", () => {
				const selected = container.find("#payment-method").val();
				const sales_invoice = this.props.sales_invoice;

				if (!sales_invoice) {
					frappe.msgprint(
						"Sales Invoice reference missing! Please create an invoice first."
					);
					return;
				}

				const btn = container.find("#submit-payment");
				btn.prop("disabled", true).text("Processing...");

				frappe.call({
					method: "gold_app.api.sales.wholesale_warehouse.create_payment_entry_for_invoice",
					args: {
						sales_invoice_name: sales_invoice,
						payment_mode: selected,
					},
					callback: (r) => {
						btn.prop("disabled", false).text("Submit Payment");

						if (r.message && r.message.status === "success") {
							frappe.show_alert({
								message: `Payment Entry Created: ${r.message.payment_entry}`,
								indicator: "green",
							});

							// Move to next tab or summary screen if callback exists
							if (this.submitCallback) this.submitCallback(r.message);
						} else {
							frappe.show_alert({
								message: "Failed to create payment entry. Please try again.",
								indicator: "red",
							});
						}
					},
					error: (err) => {
						btn.prop("disabled", false).text("Submit Payment");
						console.error("Error creating payment entry:", err);
						frappe.show_alert({
							message:
								"Error while creating payment entry. Check console for details.",
							indicator: "red",
						});
					},
				});
			});
	}
}
