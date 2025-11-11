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
                            <p id="total-amount" class="value">₹${this.total.toFixed(2)}</p>
                        </div>
                        <div>
                            <p class="label">Amount Paid</p>
                            <p id="total-paid" class="value paid">₹0.00</p>
                        </div>
                        <div>
                            <p class="label">Balance Due</p>
                            <p id="remaining-amount" class="value due">₹${this.total.toFixed(
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
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="history-body"></tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2"></td>
                                <td id="history-total">₹0.00</td>
                                <td colspan="3" class="text-right">Total Paid</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="text-right mt-3">
                    <button id="submit-all" class="btn green">Submit All Payments</button>
                </div>
        `;

		this.container.html(html);
		this.attachHandlers();
	}

	attachHandlers() {
		this.container.find("#add-payment").on("click", () => this.addPayment());
		this.container.find("#full-payment").on("click", () => this.markFullyPaid());
		this.container.find("#submit-all").on("click", () => this.submitAll());
	}

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
			frappe.confirm("Amount exceeds remaining balance. Mark fully paid instead?", () => {
				this.markFullyPaid();
			});
			return;
		}

		// --- Call backend API immediately ---
		const { sales_invoice } = this.props;
		if (!sales_invoice) {
			frappe.msgprint("Sales Invoice reference missing!");
			return;
		}

		frappe.call({
			method: "gold_app.api.sales.wholesale_warehouse.create_payment_entry_for_invoice",
			args: {
				sales_invoice_name: sales_invoice,
				payment_mode: method,
				paid_amount: amount,
			},
			callback: (r) => {
				if (r.message && r.message.status === "success") {
					// Update UI only on success
					const newPayment = { date, method, amount, ref, status: "Received" };
					this.payments.push(newPayment);
					this.paid += amount;
					this.renderHistory();
					this.updateSummary();
					this.container.find("#pay-amount").val("");
					this.container.find("#pay-ref").val("");

					frappe.show_alert({
						message: `Payment of ₹${amount} (${method}) recorded.`,
						indicator: "green",
					});
				} else {
					frappe.show_alert({
						message: "Payment entry creation failed.",
						indicator: "red",
					});
				}
			},
		});
	}

	async markFullyPaid() {
		const remaining = this.total - this.paid;
		if (remaining <= 0) {
			frappe.msgprint("Already fully paid!");
			return;
		}

		const me = this;
		const { sales_invoice } = this.props;

		// 🔹 Step 1: Show popup dialog to select payment method
		const d = new frappe.ui.Dialog({
			title: "Select Payment Method",
			fields: [
				{
					label: "Payment Method",
					fieldname: "payment_method",
					fieldtype: "Select",
					options: ["Cash", "Bank Transfer"],
					reqd: 1,
				},
			],
			primary_action_label: "Confirm",
			primary_action(values) {
				const method = values.payment_method;
				d.hide();

				// 🔹 Step 2: Proceed with backend API call
				frappe.call({
					method: "gold_app.api.sales.wholesale_warehouse.create_payment_entry_for_invoice",
					args: {
						sales_invoice_name: sales_invoice,
						payment_mode: method,
						paid_amount: remaining,
					},
					callback: (r) => {
						if (r.message && r.message.status === "success") {
							const date = frappe.datetime.now_date();
							const payment = {
								date,
								method,
								amount: remaining,
								ref: "Marked Fully Paid",
								status: "Received",
							};
							me.payments.push(payment);
							me.paid += remaining;
							me.renderHistory();
							me.updateSummary();

							frappe.show_alert({
								message: `Full payment of ₹${remaining} (${method}) recorded.`,
								indicator: "green",
							});
						} else {
							frappe.show_alert({
								message: "Payment entry creation failed.",
								indicator: "red",
							});
						}
					},
				});
			},
		});

		d.show();
	}

	async submitAll() {
		if (!this.payments.length) {
			frappe.msgprint("No payments to submit.");
			return;
		}

		const { sales_invoice } = this.props;
		if (!sales_invoice) {
			frappe.msgprint("Sales Invoice reference missing!");
			return;
		}

		for (const split of this.payments) {
			await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_payment_entry_for_invoice",
				args: {
					sales_invoice_name: sales_invoice,
					payment_mode: split.method,
					paid_amount: split.amount,
				},
				callback: (r) => {
					if (r.message && r.message.status === "success") {
						frappe.show_alert({
							message: `Payment of ₹${split.amount} (${split.method}) recorded.`,
							indicator: "green",
						});
					} else {
						frappe.show_alert({
							message: "Payment entry creation failed.",
							indicator: "red",
						});
					}
				},
			});
		}
	}

	updateSummary() {
		this.container.find("#total-paid").text(`₹${this.paid.toFixed(2)}`);
		this.container.find("#remaining-amount").text(`₹${(this.total - this.paid).toFixed(2)}`);
		this.container.find("#history-total").text(`₹${this.paid.toFixed(2)}`);
	}

	renderHistory() {
		const tbody = this.container.find("#history-body");
		tbody.empty();
		this.payments.forEach((p, i) => {
			const row = `
                <tr>
                    <td>${p.date}</td>
                    <td>${p.method}</td>
                    <td>₹${p.amount.toFixed(2)}</td>
                    <td>${p.ref || "-"}</td>
                    <td>${p.status}</td>
                    <td>
                        <button class="edit-btn" data-index="${i}">Edit</button>
                        <button class="remove-btn" data-index="${i}">Remove</button>
                    </td>
                </tr>
            `;
			tbody.append(row);
		});

		tbody.find(".remove-btn").on("click", (e) => {
			const idx = $(e.currentTarget).data("index");
			this.paid -= this.payments[idx].amount;
			this.payments.splice(idx, 1);
			this.renderHistory();
			this.updateSummary();
		});

		tbody.find(".edit-btn").on("click", (e) => {
			const idx = $(e.currentTarget).data("index");
			const p = this.payments[idx];
			this.container.find("#pay-method").val(p.method);
			this.container.find("#pay-amount").val(p.amount);
			this.container.find("#pay-ref").val(p.ref);
			this.paid -= p.amount;
			this.payments.splice(idx, 1);
			this.renderHistory();
			this.updateSummary();
		});
	}
}
