window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.payments = function ($mount, state) {
	// --------------------------------------------------
	// Local state (UI-only for now)
	// --------------------------------------------------
	let payments = Array.isArray(state.payments) ? [...state.payments] : [];

	let customerAdvanceBalance = state.payment_summary?.customer_advance_balance || 0;

	// --------------------------------------------------
	// Helpers
	// --------------------------------------------------
	const fmtRM = (val) =>
		`RM ${Number(val || 0).toLocaleString("en-MY", {
			minimumFractionDigits: 2,
		})}`;

	const getTotalAmount = () => {
		// later this will come from sale tab / state
		return state?.sale?.total_revenue || 0;
	};

	// --------------------------------------------------
	// Render UI (UNCHANGED layout)
	// --------------------------------------------------
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
					<label>Payment Method</label>
					<select id="pay-method">
						<option value="Cash">Cash</option>
						<option value="Bank Transfer">Bank Transfer</option>
						<option value="Customer Advance">Customer Advance</option>
					</select>
				</div>

				<div>
					<label>Amount to Pay</label>
					<input id="pay-amount" type="number" min="0" step="0.01" />
				</div>

				<div style="grid-column: 1 / span 2;">
					<label>Reference No. (optional)</label>
					<input id="pay-ref" type="text" />
				</div>

				<div style="display:flex;align-items:center;margin:6px 0 6px 8px;">
					<input type="checkbox" id="manual-date-toggle" />
					<label style="margin-left:6px;">Enter Date Manually</label>
				</div>

				<div id="manual-date-wrapper" style="display:none;margin-left:8px;">
					<label>Payment Date</label>
					<input id="manual-date" type="date" />
				</div>
			</div>

			<div class="form-actions">
				<button id="add-payment" class="btn green">+ Add Payment</button>
				<button id="advance-payment" class="btn blue">Use Advance</button>
				<button id="full-payment" class="btn blue" style="float:right;">
					Mark Fully Paid
				</button>
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
						<th style="text-align:right;">Amount</th>
						<th>Reference</th>
						<th>Status</th>
						<th style="text-align:center;">Remove</th>
					</tr>
				</thead>
				<tbody id="history-body"></tbody>
				<tfoot>
					<tr>
						<td colspan="2"></td>
						<td id="history-total" class="text-right font-weight-bold">
							RM0.00
						</td>
						<td colspan="3" class="text-right">Total Paid</td>
					</tr>
				</tfoot>
			</table>
		</div>
	`;

	$mount.html(html);

	// --------------------------------------------------
	// Customer Advances
	// --------------------------------------------------
	function fetchCustomerAdvance() {
		const customer = state.sale?.customer_id_number;
		if (!customer) return;

		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_melt.get_customer_advance_balance",
			args: { customer },
			callback: function (r) {
				if (r.message && r.message.status === "success") {
					customerAdvanceBalance = r.message.advance_balance || 0;
					updateSummary();
				}
			},
		});
	}

	// --------------------------------------------------
	// Core UI Logic (unchanged behaviour)
	// --------------------------------------------------
	function updateSummary() {
		const totalAmount = getTotalAmount();
		const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
		const balance = Math.max(totalAmount - totalPaid, 0);

		$mount.find("#total-amount").text(fmtRM(totalAmount));
		$mount.find("#total-paid").text(fmtRM(totalPaid));
		$mount.find("#remaining-amount").text(fmtRM(balance));
		$mount.find("#history-total").text(fmtRM(totalPaid));
		$mount.find("#customer-advance").text(fmtRM(customerAdvanceBalance));

		const $bal = $mount.find("#remaining-amount");
		$bal.removeClass("paid due");
		balance === 0 ? $bal.addClass("paid") : $bal.addClass("due");

		// ✅ sync summary into global state
		state.payment_summary = {
			total_amount: totalAmount,
			amount_paid: totalPaid,
			balance_due: balance,
			customer_advance_balance: customerAdvanceBalance,
		};

		// keep payments in global state
		state.payments = payments;
	}

	function renderHistory() {
		const $body = $mount.find("#history-body").empty();

		payments.forEach((p, i) => {
			$body.append(`
				<tr>
					<td>${p.date}</td>
					<td>${p.method}</td>
					<td class="text-right">${fmtRM(p.amount)}</td>
					<td>${p.reference || "-"}</td>
					<td>${p.status}</td>
					<td class="text-center">
						<button class="remove-payment btn btn-sm btn-danger"
							data-index="${i}">×</button>
					</td>
				</tr>
			`);
		});
	}

	// --------------------------------------------------
	// Events
	// --------------------------------------------------
	$mount.on("click", "#add-payment", () => {
		const method = $mount.find("#pay-method").val();
		const rawAmount = $mount.find("#pay-amount").val();
		const amount = rawAmount !== "" ? parseFloat(rawAmount) : NaN;

		if (isNaN(amount) || amount <= 0) {
			return;
		}

		const date =
			$mount.find("#manual-date-toggle").is(":checked") && $mount.find("#manual-date").val()
				? $mount.find("#manual-date").val().split("-").reverse().join("/")
				: new Date().toLocaleDateString("en-GB");

		payments.push({
			date,
			method,
			amount,
			reference: $mount.find("#pay-ref").val(),
			status: "Received",
		});

		$mount.find("#pay-amount, #pay-ref").val("");
		updateSummary();
		renderHistory();
	});

	$mount.on("click", ".remove-payment", function () {
		payments.splice($(this).data("index"), 1);
		updateSummary();
		renderHistory();
	});

	$mount.on("change", "#manual-date-toggle", function () {
		$("#manual-date-wrapper").toggle(this.checked);
	});

	$mount.on("click", "#advance-payment", () => {
		if (customerAdvanceBalance <= 0) {
			frappe.msgprint("No customer advance available.");
			return;
		}

		const balanceDue = getTotalAmount() - payments.reduce((s, p) => s + p.amount, 0);

		if (balanceDue <= 0) {
			frappe.msgprint("No outstanding balance to adjust.");
			return;
		}

		const useAmount = Math.min(customerAdvanceBalance, balanceDue);

		payments.push({
			date: new Date().toLocaleDateString("en-GB"),
			method: "Customer Advance",
			amount: useAmount,
			reference: "Advance Adjustment",
			status: "Received",
		});

		customerAdvanceBalance -= useAmount;

		updateSummary();
		renderHistory();
	});

	$mount.on("click", "#full-payment", () => {
		const totalAmount = getTotalAmount();
		const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
		const balanceDue = Math.max(totalAmount - totalPaid, 0);

		if (balanceDue <= 0) {
			frappe.msgprint("No outstanding balance to mark as paid.");
			return;
		}

		// Put balance due into Amount to Pay field
		$mount.find("#pay-amount").val(balanceDue.toFixed(2));
	});

	$mount.on("input", "#pay-amount", function () {
		// Remove any non-numeric characters except dot
		this.value = this.value.replace(/[^0-9.]/g, "");

		// Prevent multiple decimals
		if ((this.value.match(/\./g) || []).length > 1) {
			this.value = this.value.slice(0, -1);
		}
	});

	// --------------------------------------------------
	// Initial render
	// --------------------------------------------------
	fetchCustomerAdvance();
	updateSummary();
	renderHistory();
};
