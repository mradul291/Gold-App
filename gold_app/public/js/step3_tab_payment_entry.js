class Step3TabPaymentEntry {
	constructor(props, container, submitCallback) {
		this.props = props || {};
		this.container = container;
		this.submitCallback = submitCallback;
		this.payments = [];
		this.total = props.totalAmount || 0;
		this.paid = 0;
		this.render();
	}

	async render() {
		let html = `
                <!-- Payment Summary -->
                <div class="summary-box full-width">
                    <h3>Payment Summary</h3>
                    <div class="summary-grid wide">
                        <div>
                            <p class="label">Total Amount</p>
                            <p id="total-amount" class="value">RM${this.total.toFixed(2)}</p>
                        </div>
                        <div>
                            <p class="label">Amount Paid</p>
                            <p id="total-paid" class="value paid">RM0.00</p>
                        </div>
                        <div>
                            <p class="label">Balance Due</p>
                            <p id="remaining-amount" class="value due">RM${this.total.toFixed(
								2
							)}</p>
                        </div>
                    </div>
                </div>

                <!-- Add New Payment -->
                <div class="payment-form full-width">
                    <h3>Add New Payment</h3>
                    <div class="form-grid full">
                        <div>
                            <label>Payment Method</label>
                            <select id="pay-method">
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                            </select>
                        </div>
                        <div>
                            <label>Amount to Pay</label>
                            <input id="pay-amount" type="number" min="0" step="0.01" placeholder="Enter amount" />
                        </div>
                        <div style="grid-column: 1 / span 2;">
                            <label>Reference No. (optional)</label>
                            <input id="pay-ref" type="text" placeholder="e.g. TXN-1234" />
                        </div>
                    </div>

                    <div class="form-actions">
                        <button id="add-payment" class="btn green">+ Add Payment</button>
                        <button id="full-payment" class="btn blue right">Mark Fully Paid</button>
                    </div>
                </div>

                <!-- Payment History -->
                <div class="history-box full-width mt-4">
                    <h3>Payment History</h3>
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Reference</th>
                                <th>Status</th>
								<th>Remove</th>
                            </tr>
                        </thead>
                        <tbody id="history-body"></tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2"></td>
                                <td id="history-total">RM0.00</td>
                                <td colspan="3" class="text-right">Total Paid</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="text-right mt-3">
                        <button id="submit-payments" class="btn green">Submit Payments</button>
                    </div>
                </div>
        `;

		this.container.html(html);
		this.attachHandlers();
	}

	attachHandlers() {
		this.container.find("#add-payment").on("click", () => this.addPayment());
		this.container.find("#full-payment").on("click", () => this.markFullyPaid());
		this.container.find("#submit-payments").on("click", () => this.submitPayments());
	}

	// --- Add new payment to list (no backend call yet)
	async addPayment() {
		const date = frappe.datetime.now_date();
		const method = this.container.find("#pay-method").val();
		const amount = parseFloat(this.container.find("#pay-amount").val() || 0);
		const ref = this.container.find("#pay-ref").val();

		if (!amount || amount <= 0) {
			frappe.msgprint("Enter a valid amount!");
			return;
		}
		if (amount > this.total - this.paid) {
			frappe.msgprint("Amount exceeds remaining balance!");
			return;
		}

		const newPayment = {
			date,
			method,
			amount,
			ref,
			status: "Not Received",
		};

		this.payments.push(newPayment);
		this.paid += amount;
		this.renderHistory();
		this.updateSummary();

		// Reset form
		this.container.find("#pay-amount").val("");
		this.container.find("#pay-ref").val("");
	}

	// --- Submit all pending payments to backend
	async submitPayments() {
		const { sales_invoice, selected_bag } = this.props;

		if (!sales_invoice || !selected_bag) {
			frappe.msgprint("Missing required data: Sales Invoice or Wholesale Bag.");
			return;
		}

		// Filter only unsubmitted rows
		const pendingPayments = this.payments.filter((p) => p.status === "Not Received");

		if (!pendingPayments.length) {
			frappe.msgprint("All payments already submitted.");
			return;
		}

		// 🟡 Confirmation Dialog
		frappe.confirm(
			`Are you sure you want to submit <b>${pendingPayments.length}</b> pending payment(s)?`,
			async () => {
				// --- Proceed only if user confirms
				for (const payment of pendingPayments) {
					try {
						// Step 1: Create Payment Entry
						const peResponse = await frappe.call({
							method: "gold_app.api.sales.wholesale_warehouse.create_payment_entry_for_invoice",
							args: {
								sales_invoice_name: sales_invoice,
								payment_mode: payment.method,
								paid_amount: payment.amount,
							},
						});

						if (peResponse.message && peResponse.message.status === "success") {
							// Step 2: Record Wholesale Transaction Payment
							const wtResponse = await frappe.call({
								method: "gold_app.api.sales.wholesale_warehouse.record_wholesale_payment",
								args: {
									wholesale_bag: selected_bag,
									method: payment.method,
									amount: payment.amount,
									ref_no: payment.ref || "",
									status: "Received",
									total_amount: this.total,
								},
							});

							if (wtResponse.message && wtResponse.message.status === "success") {
								payment.status = "Received";
								frappe.show_alert({
									message: `Payment of RM${payment.amount} (${payment.method}) submitted successfully.`,
									indicator: "green",
								});
							}
						} else {
							frappe.show_alert({
								message: `Failed to create payment entry for RM${payment.amount}.`,
								indicator: "red",
							});
						}
					} catch (err) {
						console.error("Error in submitPayments:", err);
						frappe.show_alert({
							message: "Error while submitting payments.",
							indicator: "red",
						});
					}
				}

				// Refresh UI after all submissions
				this.renderHistory();
				this.updateSummary();
			},
			() => {
				// --- Cancelled by user
				frappe.show_alert({
					message: "Payment submission cancelled.",
					indicator: "orange",
				});
			}
		);
	}

	async markFullyPaid() {
		const remaining = this.total - this.paid;
		if (remaining <= 0) {
			frappe.msgprint("Already fully paid!");
			return;
		}

		const { sales_invoice, selected_bag } = this.props;
		if (!sales_invoice || !selected_bag) {
			frappe.msgprint("Missing required data: Sales Invoice or Wholesale Bag.");
			return;
		}

		const date = frappe.datetime.now_date();
		const dialog = new frappe.ui.Dialog({
			title: "Select Payment Method",
			fields: [
				{
					label: "Payment Method",
					fieldname: "payment_method",
					fieldtype: "Select",
					options: ["Cash", "Bank Transfer"],
					reqd: 1,
					default: "Cash",
				},
			],
			primary_action_label: "Confirm",
			primary_action: (values) => {
				const method = values.payment_method;
				dialog.hide();

				// Add one final payment entry for remaining amount
				const newPayment = {
					date,
					method,
					amount: remaining,
					ref: "Marked Fully Paid",
					status: "Not Received",
				};
				this.payments.push(newPayment);
				this.paid += remaining;
				this.renderHistory();
				this.updateSummary();
			},
		});

		dialog.show();
	}

	updateSummary() {
		this.container.find("#total-paid").text(`RM${this.paid.toFixed(2)}`);
		this.container.find("#remaining-amount").text(`RM${(this.total - this.paid).toFixed(2)}`);
		this.container.find("#history-total").text(`RM${this.paid.toFixed(2)}`);
	}

	renderHistory() {
		const tbody = this.container.find("#history-body");
		tbody.empty();

		this.payments.forEach((p, i) => {
			const row = `
                <tr class="${p.status === "Received" ? "received-row" : "pending-row"}">
                    <td>${p.date}</td>
                    <td>${p.method}</td>
                    <td>RM${p.amount.toFixed(2)}</td>
                    <td>${p.ref || "-"}</td>
                    <td>${p.status}</td>
					<td>
            ${
				p.status === "Not Received"
					? `<button class="btn-remove" data-index="${i}" title="Remove">🗑️</button>`
					: "-"
			}
        </td>
                </tr>
            `;
			tbody.append(row);

			// Attach remove handler for Not Received rows
			tbody
				.find(".btn-remove")
				.off("click")
				.on("click", (e) => {
					const index = $(e.currentTarget).data("index");
					const payment = this.payments[index];

					if (payment.status === "Received") {
						frappe.msgprint("You cannot remove an already received payment.");
						return;
					}

					// Adjust totals before removing
					this.paid -= payment.amount;
					this.payments.splice(index, 1);

					this.renderHistory();
					this.updateSummary();

					frappe.show_alert({
						message: `Removed RM${payment.amount} (${payment.method}) from payment list.`,
						indicator: "orange",
					});
				});
		});
	}
}
