class Step3TabPaymentEntry {
	constructor(props, container, submitCallback) {
		this.props = props || {};
		this.container = container;
		this.submitCallback = submitCallback;

		this.sales_invoice = null;

		this.payments = []; // local list
		this.total = props.totalAmount || 0;
		this.paid = 0;

		this.loadInvoiceAndPayments();

		this.render();
	}

	async loadInvoiceAndPayments() {
		const { selected_bag, buyer } = this.props;

		if (!selected_bag) {
			console.error("Missing selected_bag in props");
			return;
		}

		try {
			const r = await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.get_wholesale_transaction_by_bag",
				args: { wholesale_bag: selected_bag },
			});

			const data = r?.message?.data;

			// ⭐ Auto-load Sales Invoice from DB
			this.sales_invoice = data?.sales_invoice_ref || null;

			// ⭐ Auto-load Payments
			if (data?.payments) {
				this.payments = data.payments.map((p) => ({
					date: p.payment_date,
					method: p.payment_method,
					amount: parseFloat(p.amount) || 0,
					ref: p.reference_no || "",
					status: p.status || "Received",
				}));

				this.paid = parseFloat(data.amount_paid || 0);
				this.total = parseFloat(data.total_payment_amount || this.total);
			}

			// ⭐ Now render UI only after data load
			this.render();
		} catch (e) {
			console.error("Error loading transaction details:", e);
			this.render(); // fallback
		}
	}

	// ======================================================
	// RENDER
	// ======================================================
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
                    <p id="remaining-amount" class="value due">RM${this.total.toFixed(2)}</p>
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
                <button id="advance-payment" class="btn blue">Advance Payment</button>
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

		await this.loadExistingPayments();
		this.attachHandlers();
	}

	// ======================================================
	// LOAD EXISTING PAYMENTS
	// ======================================================
	async loadExistingPayments() {
		const { selected_bag } = this.props;

		if (!selected_bag) return;

		try {
			const res = await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.get_wholesale_transaction_by_bag",
				args: { wholesale_bag: selected_bag },
			});

			const data = res?.message?.data;

			if (data && data.payments && data.payments.length > 0) {
				this.payments = data.payments.map((p) => ({
					date: p.payment_date,
					method: p.payment_method,
					amount: parseFloat(p.amount) || 0,
					ref: p.reference_no || "",
					status: p.status || "Received",
				}));

				this.paid = parseFloat(data.amount_paid || 0);
				this.total = parseFloat(data.total_payment_amount || this.total);

				this.renderHistory();
				this.updateSummary();
			}
		} catch (err) {
			console.error("Error fetching existing payments:", err);
		}
	}

	// ======================================================
	// HANDLERS
	// ======================================================
	attachHandlers() {
		this.container.find("#add-payment").on("click", () => this.addPayment());
		this.container.find("#advance-payment").on("click", () => this.showAdvanceDialog());
		this.container.find("#full-payment").on("click", () => this.markFullyPaid());
		this.container.find("#submit-payments").on("click", () => this.submitPayments());
	}

	// ======================================================
	// ADD NORMAL PAYMENT
	// ======================================================
	async addPayment() {
		const date = frappe.datetime.now_date();
		const method = this.container.find("#pay-method").val();

		// Get raw value
		let rawAmount = this.container.find("#pay-amount").val();

		// Remove extra characters like RM, spaces, commas
		rawAmount = (rawAmount || "").replace(/[^0-9.]/g, "");

		// If user entered nothing → do nothing (avoid 0 row)
		if (!rawAmount.trim()) {
			return; // NO ALERT, NO ROW
		}

		const amount = parseFloat(rawAmount);

		// If amount is not a valid number → ignore (no row added)
		if (isNaN(amount)) {
			return; // NO ALERT, NO ROW
		}

		const ref = this.container.find("#pay-ref").val();

		// Push clean payment record
		this.payments.push({
			date,
			method,
			amount,
			ref,
			status: "Not Received",
		});

		// Update paid amount
		this.paid += amount;

		// Update UI
		this.renderHistory();
		this.updateSummary();

		// Clear fields
		this.container.find("#pay-amount").val("");
		this.container.find("#pay-ref").val("");
	}

	// ======================================================
	// ADVANCE PAYMENT DIALOG
	// ======================================================
	showAdvanceDialog() {
		const { buyer } = this.props;
		if (!buyer) {
			frappe.msgprint("Buyer is missing. Complete Step 2 first.");
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: "Record Advance Payment",
			fields: [
				{
					label: "Payment Method",
					fieldname: "payment_method",
					fieldtype: "Select",
					options: ["Cash", "Bank Transfer"],
					default: "Cash",
					reqd: 1,
				},
				{
					label: "Amount",
					fieldname: "amount",
					fieldtype: "Float",
					reqd: 1,
				},
				{
					label: "Reference No (optional)",
					fieldname: "ref_no",
					fieldtype: "Data",
				},
			],
			primary_action_label: "Add Advance Payment",
			primary_action: (values) => {
				dialog.hide();
				this.addAdvancePayment(values);
			},
		});

		dialog.show();
	}

	addAdvancePayment(values) {
		const { payment_method, amount, ref_no } = values;

		if (!amount || amount <= 0) {
			frappe.msgprint("Enter a valid amount.");
			return;
		}

		this.payments.push({
			date: frappe.datetime.now_date(),
			method: payment_method,
			amount: parseFloat(amount),
			ref: ref_no || "",
			status: "ADVANCE",
		});

		this.paid += parseFloat(amount);

		this.renderHistory();
		this.updateSummary();

		frappe.show_alert({ message: "Advance payment added.", indicator: "green" });
	}

	// ======================================================
	// SUBMIT PAYMENTS
	// ======================================================
	async submitPayments() {
		const selected_bag = this.props.selected_bag;
		const buyer = this.props.buyer;
		const sales_invoice = this.sales_invoice; // ⭐ Loaded from DB

		// Check only NON-ADVANCE payments
		const normalPayments = this.payments.filter((p) => p.status === "Not Received");

		// If normal payments exist, then invoice + bag must exist
		if (normalPayments.length > 0) {
			if (!sales_invoice || !selected_bag) {
				frappe.msgprint(
					"Missing required data: Sales Invoice or Wholesale Bag for normal payments."
				);
				return;
			}
		}

		// Advance payments DO NOT require invoice or bag
		const advancePayments = this.payments.filter((p) => p.status === "ADVANCE");
		if (advancePayments.length > 0 && !buyer) {
			frappe.msgprint("Buyer is required for advance payments.");
			return;
		}

		// FIX #1 — include ADVANCE payments
		const pendingPayments = this.payments.filter(
			(p) => p.status === "Not Received" || p.status === "ADVANCE"
		);

		if (!pendingPayments.length) {
			frappe.msgprint("All payments already submitted.");
			return;
		}

		frappe.confirm(`Submit <b>${pendingPayments.length}</b> payment(s)?`, async () => {
			let allSuccess = true;

			for (const payment of pendingPayments) {
				try {
					// ================================
					// FIX #2 — advance first
					// ================================
					if (payment.status === "ADVANCE") {
						const adv = await frappe.call({
							method: "gold_app.api.sales.wholesale_warehouse.create_customer_direct_payment",
							args: {
								party: buyer,
								mode_of_payment: payment.method,
								paid_amount: payment.amount,
							},
						});

						if (adv.message?.status === "success") {
							// FIX #3 — record log
							await frappe.call({
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

							payment.status = "Received";
							continue;
						}

						throw new Error("Advance payment failed");
					}

					// ================================
					// NORMAL SALES INVOICE PAYMENTS
					// ================================
					const peResponse = await frappe.call({
						method: "gold_app.api.sales.wholesale_warehouse.create_payment_entry_for_invoice",
						args: {
							sales_invoice_name: sales_invoice,
							payment_mode: payment.method,
							paid_amount: payment.amount,
						},
					});

					if (peResponse.message?.status === "success") {
						const wt = await frappe.call({
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

						if (wt.message?.status === "success") {
							payment.status = "Received";
						}
					}
				} catch (err) {
					allSuccess = false;
					console.error(err);
					frappe.show_alert({ message: "Error submitting payments.", indicator: "red" });
				}
			}

			this.renderHistory();
			this.updateSummary();

			if (allSuccess) location.reload();
		});
	}

	// ======================================================
	// MARK FULLY PAID
	// ======================================================
	async markFullyPaid() {
		const remaining = this.total - this.paid;
		if (remaining <= 0) {
			frappe.msgprint("Already fully paid!");
			return;
		}

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
				this.payments.push({
					date: frappe.datetime.now_date(),
					method: values.payment_method,
					amount: remaining,
					ref: "Marked Fully Paid",
					status: "Not Received",
				});

				this.paid += remaining;
				this.renderHistory();
				this.updateSummary();
				dialog.hide();
			},
		});

		dialog.show();
	}

	// ======================================================
	// SUMMARY UPDATE
	// ======================================================
	updateSummary() {
		this.container.find("#total-paid").text(`RM${this.paid.toFixed(2)}`);
		this.container.find("#remaining-amount").text(`RM${(this.total - this.paid).toFixed(2)}`);
		this.container.find("#history-total").text(`RM${this.paid.toFixed(2)}`);
	}

	// ======================================================
	// HISTORY RENDERING
	// ======================================================
	renderHistory() {
		const tbody = this.container.find("#history-body");
		tbody.empty();

		this.payments.forEach((p, i) => {
			const row = `
            <tr class="${
				p.status === "Received"
					? "received-row"
					: p.status === "ADVANCE"
					? "advance-row"
					: "pending-row"
			}">
                <td>${p.date}</td>
                <td>${p.method}</td>
                <td>RM${p.amount.toFixed(2)}</td>
                <td>${p.ref || "-"}</td>
                <td>${p.status}</td>
                <td>
                    ${
						p.status === "Not Received" || p.status === "ADVANCE"
							? `<button class="btn-remove" data-index="${i}">🗑️</button>`
							: "-"
					}
                </td>
            </tr>`;

			tbody.append(row);
		});

		tbody.find(".btn-remove").on("click", (e) => {
			const index = $(e.currentTarget).data("index");
			const payment = this.payments[index];

			if (payment.status === "Received") {
				frappe.msgprint("Cannot remove received payment.");
				return;
			}

			this.paid -= payment.amount;
			this.payments.splice(index, 1);
			this.renderHistory();
			this.updateSummary();
		});
	}
}
