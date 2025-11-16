class Step3ReceiptAndReconciliation {
	constructor(
		container,
		{
			selected_bag,
			buyer,
			buyer_name,
			sale_date,
			bagSummary,
			totalAmount,
			reconSummary = [],
			adjustments = [],
		},
		backCallback
	) {
		this.container = container;
		this.selected_bag = selected_bag;
		this.buyer = buyer;
		this.buyer_name = buyer_name;
		this.sale_date = sale_date;
		this.bagSummary = bagSummary;
		this.totalAmount = totalAmount;
		this.reconSummary = reconSummary.length ? reconSummary : this.initializeReconSummary();
		this.adjustments = adjustments;
		this.backCallback = backCallback;
		this.activeTab = "Sale Details";
		this.sales_invoice = null;
		this.checkExistingInvoiceAndRender();
	}

	async checkExistingInvoiceAndRender() {
		try {
			const r = await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.get_wholesale_transaction_by_bag",
				args: { wholesale_bag: this.selected_bag },
			});

			const data = r?.message?.data;

			// ⭐ Invoice already exists → skip to Payment Entry tab
			if (data && data.sales_invoice_ref) {
				console.log("Sales Invoice exists, auto-skipping to Payment Entry");
				this.sales_invoice = data.sales_invoice_ref;
				this.activeTab = "Payment Entry";
			} else {
				console.log("No invoice found, showing normal flow");
			}

			this.render();
		} catch (err) {
			console.error("Error checking invoice:", err);
			this.render(); // fallback
		}
	}

	initializeReconSummary() {
		return this.bagSummary.map((r) => ({
			purity: r.purity,
			actual: 0,
			claimed: r.weight,
			cost_basis: r.amount,
			revenue: 0,
			profit: -r.amount,
			profit_g: 0,
			margin_percent: 0,
		}));
	}

	render() {
		let tabs = ["Sale Details", "Receipt & Reconciliation", "Payment Entry"];
		let html = `
        <div class="receipt-recon-container">
            <div class="tab-row">
                ${tabs
					.map(
						(tab) => `
                    <div class="tab ${
						this.activeTab === tab ? "tab-active" : ""
					}" data-tab="${tab}">${tab}</div>
                `
					)
					.join("")}
            </div>
            <div class="tab-content"></div>
        </div>
        `;
		this.container.html(html);

		// Tab switching
		this.container.find(".tab").on("click", (e) => {
			let tab = $(e.target).data("tab");
			if (tab === this.activeTab) return;
			this.activeTab = tab;
			this.render();
		});

		// Tab content rendering: call tab component
		const tabContentContainer = this.container.find(".tab-content");
		if (this.activeTab === "Sale Details") {
			new Step3TabSaleDetails(
				{
					selected_bag: this.selected_bag,
					buyer: this.buyer,
					sale_date: this.sale_date,
					bagSummary: this.bagSummary,
					totalAmount: this.totalAmount,
					buyer_name: this.buyer_name || this.buyer,
				},
				tabContentContainer,
				() => {
					this.activeTab = "Receipt & Reconciliation";
					this.render();
				}
			);
		} else if (this.activeTab === "Receipt & Reconciliation") {
			new Step3TabReceiptReconciliation(
				{
					selected_bag: this.selected_bag,
					buyer: this.buyer,
					customer: this.buyer,
					sale_date: this.sale_date,
					bagSummary: this.bagSummary,
					totalAmount: this.totalAmount,
					reconSummary: this.reconSummary,
					adjustments: this.adjustments,
				},
				tabContentContainer,
				() => {
					this.activeTab = "Sale Details";
					this.render();
				},
				() => {
					this.activeTab = "Payment Entry";
					this.render();
				},
				(nextReconSummary, nextAdjustments) => {
					// Optional: Sync adjustments & reconciliation if changed
					this.reconSummary = nextReconSummary;
					this.adjustments = nextAdjustments;
				},
				(invoiceRef) => {
					// This callback receives the invoice ref from receipt tab
					this.sales_invoice = invoiceRef;
					console.log("Invoice reference saved in controller:", invoiceRef);
				}
			);
		} else if (this.activeTab === "Payment Entry") {
			new Step3TabPaymentEntry(
				{
					selected_bag: this.selected_bag,
					buyer: this.buyer,
					sale_date: this.sale_date,
					bagSummary: this.bagSummary,
					totalAmount: this.totalAmount,
					reconSummary: this.reconSummary,
					adjustments: this.adjustments,
					sales_invoice: this.sales_invoice || null,
				},
				tabContentContainer
			);
		}
	}
}
