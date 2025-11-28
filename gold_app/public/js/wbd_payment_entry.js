class WholesaleBagDirectPayment {
	constructor(containerSelector, getRefsCallback) {
		this.containerSelector = containerSelector;
		this.getRefs = getRefsCallback;
		this.payments = []; // Local payment history
		this.render();
		this.hide();
		this.bindEvents();
	}

	render() {
		const html = `
      <!-- Payment Summary -->
      <div class="summary-box full-width mb-4">
          <h3>Payment Summary</h3>
          <div class="summary-grid wide">
              <div>
                  <p class="label">Total Amount</p>
                  <p id="total-amount" class="value">RM0.00</p>
              </div>
              <div>
                  <p class="label">Amount Paid</p>
                  <p id="total-paid" class="value paid">RM0.00</p>
              </div>
              <div>
                  <p class="label">Balance Due</p>
                  <p id="remaining-amount" class="value due">RM0.00</p>
              </div>
              <div>
                  <p class="label">Customer Advance Balance</p>
                  <p id="customer-advance" class="value">RM0.00</p>
              </div>
          </div>
      </div>

      <!-- Add New Payment -->
      <div class="payment-form full-width mb-4">
          <h3>Add New Payment</h3>
          <div class="form-grid full" style="margin-bottom: 1em;">
              <div>
                  <label for="pay-method">Payment Method</label>
                  <select id="pay-method">
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Customer Advance">Customer Advance</option>
                  </select>
              </div>
              <div>
                  <label for="pay-amount">Amount to Pay</label>
                  <input id="pay-amount" type="number" min="0" step="0.01" placeholder="Enter amount" />
              </div>
              <div style="grid-column: 1 / span 2;">
                  <label for="pay-ref">Reference No. (optional)</label>
                  <input id="pay-ref" type="text" placeholder="e.g. TXN-1234" />
              </div>
          </div>

          <div class="form-actions">
              <button id="add-payment" class="btn green">+ Add Payment</button>
              <button id="advance-payment" class="btn blue">Use Advance</button>
              <button id="full-payment" class="btn blue" style="float: right;">Mark Fully Paid</button>
          </div>
      </div>

      <!-- Payment History -->
      <div class="history-box full-width">
          <h3>Payment History</h3>
          <table class="history-table">
              <thead>
                  <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th style="text-align: right;">Amount</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th style="text-align: center;">Remove</th>
                  </tr>
              </thead>
              <tbody id="history-body"></tbody>
              <tfoot>
                  <tr>
                      <td colspan="2"></td>
                      <td id="history-total" class="text-right font-weight-bold">RM0.00</td>
                      <td colspan="3" class="text-right">Total Paid</td>
                  </tr>
              </tfoot>
          </table>

          <div class="text-right mt-3 mb-4">
              <button id="submit-payments" class="btn green">Submit Payments</button>
          </div>
      </div>
    `;
		$(this.containerSelector).html(html);
	}

	bindEvents() {
		const self = this;

		// Add Payment button
		$(this.containerSelector).on("click", "#add-payment", function () {
			self.addPayment();
		});

		$(this.containerSelector).on("click", "#advance-payment", function () {
			self.addAdvancePayment();
		});

		// Full Payment button
		$(this.containerSelector).on("click", "#full-payment", function () {
			self.markFullPayment();
		});

		// Submit Payments button
		$(this.containerSelector).on("click", "#submit-payments", function () {
			self.submitAllPayments();
		});

		// Remove payment row
		$(this.containerSelector).on("click", ".remove-payment", function () {
			const index = $(this).data("index");
			self.removePayment(index);
		});

		// Enter key on amount field
		$(this.containerSelector).on("keypress", "#pay-amount", function (e) {
			if (e.which === 13) {
				self.addPayment();
			}
		});

		// Real-time Customer Advance balance preview
		$(this.containerSelector).on("input", "#pay-amount", () => {
			this.updateAdvancePreview();
		});
	}

	updateSummary() {
		const refs = this.getRefs();
		const totalAmount = refs.total_selling_amount || 0;
		const totalPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);
		const balanceDue = Math.max(totalAmount - totalPaid, 0);

		// Update display values
		$(this.containerSelector)
			.find("#total-amount")
			.text(`RM ${totalAmount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
		$(this.containerSelector)
			.find("#total-paid")
			.text(`RM ${totalPaid.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
		$(this.containerSelector)
			.find("#remaining-amount")
			.text(`RM ${balanceDue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
		$(this.containerSelector)
			.find("#history-total")
			.text(`RM ${totalPaid.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);

		// Visual feedback
		const $balance = $(this.containerSelector).find("#remaining-amount");
		$balance.removeClass("due paid");
		if (balanceDue === 0) {
			$balance.addClass("paid").css("color", "green");
		} else {
			$balance.addClass("due").css("color", "#dc3545");
		}
	}

	renderPaymentHistory() {
		const $tbody = $(this.containerSelector).find("#history-body");
		$tbody.empty();

		this.payments.forEach((payment, index) => {
			const row = `
				<tr>
					<td>${payment.date}</td>
					<td>${payment.method}</td>
					<td class="text-right">RM ${payment.amount.toLocaleString("en-MY", {
						minimumFractionDigits: 2,
					})}</td>
					<td>${payment.reference || "-"}</td>
					<td><span class="status pending">${payment.status || "Received"}</span></td>
					<td class="text-center">
						<button class="btn btn-sm btn-danger remove-payment" data-index="${index}">×</button>
					</td>
				</tr>
			`;
			$tbody.append(row);
		});
	}

	loadCustomerAdvance() {
		const refs = this.getRefs();
		const customerId = refs.customer_id;

		if (!customerId) {
			// No customer selected → reset display
			$(this.containerSelector).find("#customer-advance").text("RM0.00");
			return;
		}

		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_direct.get_customer_advance_balance",
			args: {
				customer: customerId,
			},
			callback: (r) => {
				if (r.message && r.message.status === "success") {
					const adv = r.message.advance_balance || 0;

					this.customerAdvanceBalance = adv;

					$(this.containerSelector)
						.find("#customer-advance")
						.text(
							`RM ${this.customerAdvanceBalance.toLocaleString("en-MY", {
								minimumFractionDigits: 2,
							})}`
						);
				} else {
					$(this.containerSelector).find("#customer-advance").text("RM0.00");
				}
			},
		});
	}

	updateAdvancePreview() {
		const method = $(this.containerSelector).find("#pay-method").val();
		const amountInput = parseFloat($(this.containerSelector).find("#pay-amount").val()) || 0;

		if (method !== "Customer Advance") {
			return;
		}

		const previewBalance = Math.max(this.customerAdvanceBalance - amountInput, 0);

		$(this.containerSelector)
			.find("#customer-advance")
			.text(
				`RM ${previewBalance.toLocaleString("en-MY", {
					minimumFractionDigits: 2,
				})}`
			);
	}

	addPayment() {
		const method = $(this.containerSelector).find("#pay-method").val();
		if (method === "Customer Advance") {
			frappe.msgprint("Please use the 'Use Advance' button for advance payments.");
			return;
		}

		const amountInput = parseFloat($(this.containerSelector).find("#pay-amount").val()) || 0;
		const reference = $(this.containerSelector).find("#pay-ref").val().trim();

		// Existing validations
		if (!method) {
			frappe.msgprint("Please select a payment method.");
			return;
		}
		if (amountInput <= 0) {
			frappe.msgprint("Please enter a valid amount.");
			return;
		}

		const refs = this.getRefs();
		const totalAmount = refs.total_selling_amount || 0;
		const totalPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);
		if (totalPaid + amountInput > totalAmount) {
			frappe.msgprint("Payment amount cannot exceed total amount.");
			return;
		}

		// Add to payments array
		const now = new Date();
		const dateStr = now.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		this.payments.push({
			date: dateStr,
			method: method,
			amount: amountInput,
			reference: reference || "",
			status: "Received",
			invoice_id: refs.invoice_id,
			log_id: refs.log_id,
		});

		// Clear form
		$(this.containerSelector).find("#pay-amount").val("");
		$(this.containerSelector).find("#pay-ref").val("");

		// Update UI
		this.updateSummary();
		this.renderPaymentHistory();

		frappe.show_alert({
			message: `Added payment of RM ${amountInput.toLocaleString("en-MY", {
				minimumFractionDigits: 2,
			})}`,
			indicator: "green",
		});
	}

	addAdvancePayment() {
		const method = "Customer Advance";
		const amountInput = parseFloat($(this.containerSelector).find("#pay-amount").val()) || 0;

		if (amountInput <= 0) {
			frappe.msgprint("Please enter a valid advance amount.");
			return;
		}

		// ---- NEW LOGIC: UPDATE EXISTING ADVANCE ROW ----
		const existingAdvance = this.payments.find((p) => p.method === "Customer Advance");

		if (existingAdvance) {
			// VALIDATION: Prevent overpayment
			const refs = this.getRefs();
			const totalAmount = refs.total_selling_amount || 0;

			const otherPayments = this.payments
				.filter((p) => p.method !== "Customer Advance")
				.reduce((sum, p) => sum + p.amount, 0);

			const newAdvanceTotal = existingAdvance.amount + amountInput;

			if (otherPayments + newAdvanceTotal > totalAmount) {
				frappe.msgprint(
					"Advance payment exceeds total amount. Please enter a valid amount."
				);
				return;
			}

			// Update existing row amount
			existingAdvance.amount += amountInput;

			// Deduct from UI-level advance balance
			this.customerAdvanceBalance -= amountInput;

			// Update UI advance balance immediately
			$(this.containerSelector)
				.find("#customer-advance")
				.text(
					`RM ${this.customerAdvanceBalance.toLocaleString("en-MY", {
						minimumFractionDigits: 2,
					})}`
				);

			this.updateSummary();
			this.renderPaymentHistory();

			frappe.show_alert({
				message: `Updated Customer Advance: RM ${existingAdvance.amount.toLocaleString(
					"en-MY",
					{ minimumFractionDigits: 2 }
				)}`,
				indicator: "blue",
			});

			// ---- NEW: Also allocate the newly added advance to backend ----
			frappe.call({
				method: "gold_app.api.sales.wholesale_bag_direct.allocate_customer_advance_to_invoice",
				args: {
					sales_invoice_name: refs.invoice_id,
					allocate_amount: amountInput, // ONLY allocate the new difference
				},
				callback: (r) => {
					if (r.message && r.message.status === "success") {
						frappe.show_alert({
							message: `Allocated additional RM ${amountInput.toLocaleString(
								"en-MY",
								{
									minimumFractionDigits: 2,
								}
							)} from Customer Advance`,
							indicator: "blue",
						});
					} else {
						frappe.msgprint(
							`Advance allocation failed: ${r.message.message || "Unknown error"}`
						);
						// rollback UI change
						existingAdvance.amount -= amountInput;
						this.updateSummary();
						this.renderPaymentHistory();
					}
				},
				error: () => {
					frappe.msgprint("Failed to allocate additional advance payment.");
					// rollback UI change
					existingAdvance.amount -= amountInput;
					this.updateSummary();
					this.renderPaymentHistory();
				},
			});

			// Clear fields
			$(this.containerSelector).find("#pay-amount").val("");
			$(this.containerSelector).find("#pay-ref").val("");

			return;
		}

		// ---- END NEW LOGIC ----

		const refs = this.getRefs();
		const totalAmount = refs.total_selling_amount || 0;
		const totalPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);

		if (totalPaid + amountInput > totalAmount) {
			frappe.msgprint("Payment amount cannot exceed total amount.");
			return;
		}

		const now = new Date();
		const dateStr = now.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		this.payments.push({
			date: dateStr,
			method: method,
			amount: amountInput,
			reference: "",
			status: "Allocated",
			invoice_id: refs.invoice_id,
			log_id: refs.log_id,
		});
		// Deduct from UI managed balance
		this.customerAdvanceBalance -= amountInput;

		// Update UI advance balance immediately
		$(this.containerSelector)
			.find("#customer-advance")
			.text(
				`RM ${this.customerAdvanceBalance.toLocaleString("en-MY", {
					minimumFractionDigits: 2,
				})}`
			);

		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_direct.allocate_customer_advance_to_invoice",
			args: {
				sales_invoice_name: refs.invoice_id,
				allocate_amount: amountInput,
			},
			callback: (r) => {
				if (r.message && r.message.status === "success") {
					frappe.show_alert({
						message: `Allocated RM ${amountInput.toLocaleString("en-MY", {
							minimumFractionDigits: 2,
						})} from Customer Advance`,
						indicator: "blue",
					});
					this.updateSummary();
					this.renderPaymentHistory();
				} else {
					frappe.msgprint(
						`Advance allocation failed: ${r.message.message || "Unknown error"}`
					);
					this.payments = this.payments.filter(
						(p) =>
							!(
								p.method === method &&
								p.amount === amountInput &&
								p.date === dateStr
							)
					);
					this.updateSummary();
					this.renderPaymentHistory();
				}
			},
			error: () => {
				frappe.msgprint("Failed to allocate advance payment.");
				this.payments = this.payments.filter(
					(p) => !(p.method === method && p.amount === amountInput && p.date === dateStr)
				);
				this.updateSummary();
				this.renderPaymentHistory();
			},
		});

		$(this.containerSelector).find("#pay-amount").val("");
		$(this.containerSelector).find("#pay-ref").val("");
	}

	markFullPayment() {
		const refs = this.getRefs();
		const remaining =
			refs.total_selling_amount - this.payments.reduce((sum, p) => sum + p.amount, 0);

		if (remaining <= 0) {
			frappe.msgprint("Already fully paid.");
			return;
		}

		// Auto-fill remaining amount with Cash method
		$(this.containerSelector).find("#pay-method").val("Cash");
		$(this.containerSelector).find("#pay-amount").val(remaining.toFixed(2));
		$(this.containerSelector).find("#pay-ref").focus();
	}

	removePayment(index) {
		const removedPayment = this.payments[index];

		// NEW: Handle Customer Advance removal with backend call
		if (removedPayment.method === "Customer Advance") {
			const refs = this.getRefs();

			frappe.call({
				method: "gold_app.api.sales.wholesale_bag_direct.remove_customer_advance_allocation",
				args: {
					sales_invoice_name: refs.invoice_id,
					remove_amount: removedPayment.amount,
				},
				callback: (r) => {
					if (r.message && r.message.status === "success") {
						// Remove row from UI
						this.payments.splice(index, 1);

						// Restore the UI-level advance balance
						this.customerAdvanceBalance += removedPayment.amount;

						// Update UI display
						$(this.containerSelector)
							.find("#customer-advance")
							.text(
								`RM ${this.customerAdvanceBalance.toLocaleString("en-MY", {
									minimumFractionDigits: 2,
								})}`
							);

						this.updateSummary();
						this.renderPaymentHistory();

						frappe.show_alert({
							message: `Removed RM ${removedPayment.amount.toLocaleString("en-MY", {
								minimumFractionDigits: 2,
							})} Customer Advance allocation`,
							indicator: "red",
						});
					} else {
						frappe.msgprint("Failed to remove advance allocation from invoice.");
					}
				},
				error: () => {
					frappe.msgprint("Backend error while removing Customer Advance allocation.");
				},
			});

			return; // Do NOT continue normal removal
		}

		// Normal removal for Cash/Bank rows
		this.payments.splice(index, 1);
		this.updateSummary();
		this.renderPaymentHistory();
	}

	async submitAllPayments() {
		const refs = this.getRefs();
		const totalAmount = refs.total_selling_amount || 0;
		const totalPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);

		if (this.payments.length === 0) {
			frappe.msgprint("No payments to submit.");
			return;
		}

		// >>> NEW VALIDATION: Payment total must match Total Amount <<<
		if (totalPaid < totalAmount) {
			frappe.msgprint(
				"Payments are less than total amount. Please complete the full payment before submitting."
			);
			return;
		}

		if (totalPaid > totalAmount) {
			frappe.msgprint(
				"Payments exceed total amount. Please adjust payment entries before submitting."
			);
			return;
		}

		// >>> END VALIDATION <<<
		if (!refs.invoice_id) {
			frappe.msgprint("Sales Invoice not created. Please save and create invoice first.");
			return;
		}

		const submitBtn = $(this.containerSelector).find("#submit-payments");
		submitBtn.prop("disabled", true).text("Submitting...");

		try {
			// REMOVED: submit_sales_invoice_if_draft call - handled by payment entry API

			// Create payment entries only for non-advance payments (Cash/Bank)
			const regularPayments = this.payments.filter((p) => p.method !== "Customer Advance");

			for (const payment of regularPayments) {
				const result = await frappe.call({
					method: "gold_app.api.sales.wholesale_bag_direct.create_payment_entry_for_invoice",
					args: {
						sales_invoice_name: refs.invoice_id,
						payment_mode: payment.method,
						paid_amount: payment.amount,
					},
				});

				if (result.message.status !== "success") {
					throw new Error("Payment submission failed");
				}
			}

			// ----- Update Wholesale Bag Direct Sale log with payments -----
			const totalAmount = refs.total_selling_amount || 0;
			const amountPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);

			// Map UI payments to server structure
			const paymentsPayload = this.payments.map((p) => ({
				payment_date: p.date,
				payment_method: p.method,
				amount: p.amount,
				reference_no: p.reference || "",
				status: p.status || "Received",
			}));

			if (refs.log_id) {
				await frappe.call({
					method: "gold_app.api.sales.wholesale_bag_direct.update_wholesale_bag_direct_payments",
					args: {
						log_id: refs.log_id,
						payments: JSON.stringify(paymentsPayload),
						total_amount: totalAmount,
						amount_paid: amountPaid,
					},
				});
			}

			// Success - clear payments and update UI
			this.payments = [];
			this.updateSummary();
			this.renderPaymentHistory();
			this.loadCustomerAdvance();

			frappe.msgprint({
				title: "Success",
				message: `All Payment Entries created successfully!`,
				indicator: "green",
			});
			// Reload entire page after a short delay
			setTimeout(() => {
				location.reload();
			}, 1000);
		} catch (error) {
			frappe.msgprint({
				title: "Payment Submission Failed",
				message: error.message || "Failed to process payments.",
				indicator: "red",
			});
		} finally {
			submitBtn.prop("disabled", false).text("Submit Payments");
		}
	}

	show() {
		$(this.containerSelector).show();
		this.updateSummary(); // Refresh summary with latest data
		this.renderPaymentHistory();
		this.loadCustomerAdvance();
	}

	hide() {
		$(this.containerSelector).hide();
	}
}

// Make globally accessible
window.WholesaleBagDirectPayment = WholesaleBagDirectPayment;
