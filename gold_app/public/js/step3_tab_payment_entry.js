class Step3TabPaymentEntry {
	constructor(props, container, submitCallback) {
		this.props = props;
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
                <button id="submit-payment" class="btn btn-primary mt-3">Submit</button>
            </div>
        </div>
        `);
	}

	attachHandlers() {
		const container = this.container;
		container
			.find("#payment-method")
			.off("change")
			.on("change", function () {
				const selected = $(this).val();
				if (selected === "Bank Transfer" || selected === "Mix") {
					alert(`Selected Payment Method: ${selected}. (Dummy action for now)`);
				}
			});

		container
			.find("#submit-payment")
			.off("click")
			.on("click", () => {
				const selected = container.find("#payment-method").val();
				frappe.show_alert({
					message: `Payment Submitted using: ${selected}`,
					indicator: "green",
				});
				if (this.submitCallback) this.submitCallback();
			});
	}
}
