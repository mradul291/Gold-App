// Version - 1

class Step3TabSaleDetails {
	constructor(props, container, continueCallback) {
		this.props = props;
		this.container = container;
		this.continueCallback = continueCallback;
		this.render();
	}

	async render() {
		const { selected_bag, buyer, sale_date, bagSummary, totalAmount, buyer_name } = this.props;
		console.log("Buyer ID:", buyer, "Buyer Name:", buyer_name);
		console.log("Props in Step3TabSaleDetails:", this.props);

		// Wrap content with loader
		let html = `
            <div class="sale-details-wrapper">
                <!-- Loader (shown initially) -->
                <div class="loader-overlay">
                    <div class="loader"></div>
                    <p>Loading sale details, please wait...</p>
                </div>
                
                <!-- Content (hidden initially) -->
                <div class="sale-details-content" style="display:none;">
                    <div class="summary-section">
                        <h4 class="section-title">Sale Summary</h4>
                        <div class="summary-row">
                            <div class="summary-block">
                                <div class="summary-label">Wholesale Bag</div>
                                <div class="summary-value">${selected_bag}</div>
                            </div>
                            <div class="summary-block">
                                <div class="summary-label">Buyer</div>
                                <div class="summary-value">
                                    ${buyer}${buyer_name ? " - " + buyer_name : ""}
                                </div>
                            </div>
                        </div>
                        <div class="summary-row">
                            <div class="summary-block">
                                <div class="summary-label">Sale Date</div>
                                <div class="summary-value">${sale_date}</div>
                            </div>
                            <div class="summary-block summary-block-highlight">
                                <div class="summary-label">Total Cost Basis</div>
                                <div class="summary-value summary-value-highlight">
                                    RM ${totalAmount.toLocaleString("en-MY", {
										minimumFractionDigits: 2,
									})}
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr>
                    <div class="bag-content-section">
                        <h4 class="section-title">Bag Contents</h4>
                        <table class="summary-table">
                            <thead>
                                <tr>
                                    <th>Purity</th>
                                    <th>Weight (g)</th>
                                    <th>AVCO (RM/g)</th>
                                    <th>Total Cost (RM)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bagSummary
									.map(
										(r) => `
                                    <tr>
                                        <td>${r.purity}</td>
                                        <td>${(r.weight || 0).toFixed(2)} g</td>
                                        <td>${(r.rate || 0).toFixed(2)}</td>
                                        <td>RM ${(r.amount || 0).toLocaleString("en-MY", {
											minimumFractionDigits: 2,
										})}</td>
                                    </tr>
                                `
									)
									.join("")}
                                <tr class="summary-total-row">
                                    <td><b>TOTAL</b></td>
                                    <td><b>${bagSummary
										.reduce((t, r) => t + r.weight, 0)
										.toFixed(2)} g</b></td>
                                    <td>-</td>
                                    <td><b>RM ${totalAmount.toLocaleString("en-MY", {
										minimumFractionDigits: 2,
									})}</b></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <hr>
                    <div class="action-row">
                        <button class="btn-primary continue-btn">Continue to Receipt Input →</button>
                    </div>
                </div>
            </div>
        `;

		this.container.html(html);

		// For now, just a small delay for visual consistency
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Hide loader and show content
		const loader = this.container.find(".loader-overlay");
		const content = this.container.find(".sale-details-content");

		loader.fadeOut(200, () => {
			content.fadeIn(200);
			// Attach handlers after content is visible
			this.attachHandlers();
		});
	}

	attachHandlers() {
		this.container.find(".continue-btn").on("click", this.continueCallback);
	}
}

// Version - 2

// class Step3TabSaleDetails {
// 	constructor(props, container, continueCallback) {
// 		this.props = props;
// 		this.container = container;
// 		this.continueCallback = continueCallback;
// 		this.init();
// 	}
// 	async init() {
// 		try {
// 			const res = await frappe.call({
// 				method: "gold_app.api.sales.wholesale_warehouse.get_wholesale_transaction_by_bag",
// 				args: { wholesale_bag: this.props.selected_bag },
// 			});

// 			if (res.message && res.message.status === "success") {
// 				const data = res.message.data;
// 				// Update props from fetched saved data
// 				this.props.buyer = data.buyer || this.props.buyer;
// 				this.props.buyer_name = data.buyer_name || this.props.buyer_name;
// 				this.props.sale_date = data.sale_date || this.props.sale_date;
// 				this.props.bagSummary = data.receipt_lines || this.props.bagSummary || [];
// 				this.props.totalAmount = data.total_cost_basis || this.props.totalAmount || 0;
// 			}
// 		} catch (e) {
// 			// Failed to fetch backend data: silently keep existing props
// 			console.warn("Could not fetch saved transaction data:", e);
// 		}

// 		// Now render UI with loaded or default props
// 		this.render();
// 		this.attachHandlers();
// 	}

// 	render() {
// 		const { selected_bag, buyer, sale_date, bagSummary, totalAmount, buyer_name } = this.props;
// 		console.log("Buyer ID:", buyer, "Buyer Name:", buyer_name);
// 		console.log("Props in Step3TabSaleDetails:", this.props);

// 		this.container.html(`
//         <div class="summary-section">
//             <h4 class="section-title">Sale Summary</h4>
//             <div class="summary-row">
//                 <div class="summary-block">
//                     <div class="summary-label">Wholesale Bag</div>
//                     <div class="summary-value">${selected_bag}</div>
//                 </div>
//                 <div class="summary-block">
//                     <div class="summary-label">Buyer</div>
//                     <div class="summary-value">
//     ${buyer}${buyer_name ? " - " + buyer_name : ""}
// </div>

//                 </div>
//             </div>
//             <div class="summary-row">
//                 <div class="summary-block">
//                     <div class="summary-label">Sale Date</div>
//                     <div class="summary-value">${sale_date}</div>
//                 </div>
//                 <div class="summary-block summary-block-highlight">
//                     <div class="summary-label">Total Cost Basis</div>
//                     <div class="summary-value summary-value-highlight">
//                         RM ${totalAmount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
//                     </div>
//                 </div>
//             </div>
//         </div>
//         <hr>
//         <div class="bag-content-section">
//             <h4 class="section-title">Bag Contents</h4>
//             <table class="summary-table">
//                 <thead>
//                     <tr>
//                         <th>Purity</th>
//                         <th>Weight (g)</th>
//                         <th>AVCO (RM/g)</th>
//                         <th>Total Cost (RM)</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     ${bagSummary
// 						.map(
// 							(r) => `
//                         <tr>
//                             <td>${r.purity}</td>
//                             <td>${(r.weight || 0).toFixed(2)} g</td>
//                             <td>${(r.rate || 0).toFixed(2)}</td>
//                             <td>RM ${(r.amount || 0).toLocaleString("en-MY", {
// 								minimumFractionDigits: 2,
// 							})}</td>
//                         </tr>
//                     `
// 						)
// 						.join("")}
//                     <tr class="summary-total-row">
//                         <td><b>TOTAL</b></td>
//                         <td><b>${bagSummary
// 							.reduce((t, r) => t + r.weight, 0)
// 							.toFixed(2)} g</b></td>
//                         <td>-</td>
//                         <td><b>RM ${totalAmount.toLocaleString("en-MY", {
// 							minimumFractionDigits: 2,
// 						})}</b></td>
//                     </tr>
//                 </tbody>
//             </table>
//         </div>
//         <hr>
//         <div class="action-row">
//             <button class="btn-primary continue-btn">Continue to Receipt Input →</button>
//         </div>
//         `);
// 	}

// 	attachHandlers() {
// 		this.container.find(".continue-btn").on("click", this.continueCallback);
// 	}
// }
