class Step3TabReceiptReconciliation {
  constructor(
    props,
    container,
    backCallback,
    continueCallback,
    syncDataCallback,
    onSalesInvoiceCreated
  ) {
    this.props = props;
    this.container = container;
    this.backCallback = backCallback;
    this.continueCallback = continueCallback;
    this.syncDataCallback = syncDataCallback;
    this.onSalesInvoiceCreated = onSalesInvoiceCreated;
    this.salesDetailData = JSON.parse(JSON.stringify(props.bagSummary || []));
    this.selected_bag = props.selected_bag || "";

    this.reconSummary = props.reconSummary.length
      ? props.reconSummary
      : this.initializeReconSummary();
    this.adjustments = props.adjustments;
    this.bagSummary = [];
    this.uploadedReceiptUrl = "";
    this.availablePurities = [];

    this.showLoader();

    this.fetchPuritiesFromDoctype().then(async (purities) => {
      this.availablePurities = purities;

      await this.loadExistingTransactionData();

      this.render();
      this.bindReceiptEvents();
      this.bindUploadReceipt();
      this.renderAdjustmentsSection();
      this.attachNavHandlers();
      this.hideLoader();
    });
  }

  showLoader() {
    this.container.html(`
            <div class="loader-overlay">
                <div class="loader"></div>
                <p>Loading receipt details, please wait...</p>
            </div>
        `);
  }

  hideLoader() {}

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

  renderAndBindAll() {
    this.render();
    this.bindReceiptEvents();
    this.bindUploadReceipt();
    this.renderAdjustmentsSection();
    this.attachNavHandlers();
    this.updateReconciliationSummary();
  }

  async fetchPuritiesFromDoctype() {
    try {
      const response = await frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Purity",
          fields: ["name"],
          limit_page_length: 100,
          order_by: "name asc",
        },
      });
      // Extract purity names from result
      return response.message.map((item) => item.name);
    } catch (error) {
      console.error("Error fetching purities:", error);
      return [];
    }
  }

  async loadExistingTransactionData() {
    try {
      // Fetch existing transaction
      const res = await frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Wholesale Transaction",
          filters: {
            wholesale_bag: this.props.selected_bag,
            buyer: this.props.customer,
          },
          fields: ["name"],
          limit: 1,
        },
      });

      if (!res.message || res.message.length === 0) {
        console.log("No existing transaction found → load empty UI");
        return;
      }

      const txnName = res.message[0].name;

      const txnDoc = await frappe.call({
        method: "frappe.client.get",
        args: { doctype: "Wholesale Transaction", name: txnName },
      });

      this.existing_txn = txnDoc.message;

      // ⭐ Load receipt_lines into UI only if saved earlier
      if (
        this.existing_txn.receipt_lines &&
        this.existing_txn.receipt_lines.length > 0
      ) {
        this.bagSummary = this.existing_txn.receipt_lines.map((r) => ({
          purity: r.purity,
          weight: parseFloat(r.weight) || 0,
          rate: parseFloat(r.rate) || 0,
          amount: parseFloat(r.amount) || 0,
        }));
      } else {
        // First time → Keep Table EMPTY
        this.bagSummary = [];
      }

      // ⭐ Load saved adjustments
      if (this.existing_txn.adjustments) {
        this.adjustments = this.existing_txn.adjustments.map((a) => ({
          type: a.adjustment_type,
          from_purity: a.from_purity,
          to_purity: a.to_purity,
          weight: a.weight,
          notes: a.notes,
          impact: a.profit_impact,
        }));
      }
    } catch (err) {
      console.error("Failed to load existing txn:", err);
    }
  }

  render() {
    this.container.html(`
        <div class="section1-buyer-receipt">
            <h4 class="section-title">Section 1: Buyer's Official Receipt</h4>
            <p class="input-caption">Enter what the buyer actually paid for</p>
            <table class="receipt-table">
                <thead><tr><th>Move</th><th>Purity</th><th>Weight (g) *</th><th>Rate (RM/g)</th><th>Amount (RM)</th><th>Action</th></tr></thead>
                <tbody></tbody>
            </table>
            <button class="add-receipt-line-btn btn-receipt">+ Add Receipt Line</button>
            <button class="btn-upload-receipt">Upload Receipt</button>
        </div>
        <hr>
        <div class="section2-recon-summary">
            <h4 class="section-title">Section 2: Reconciliation Summary</h4>
            <p class="input-caption">Live updates as adjustments are added</p>
            <table class="recon-table">
                <thead><tr><th>Purity</th><th>Actual (g)</th><th>Claimed (g)</th><th>Δ (g)</th><th>Status</th><th>Cost Basis</th><th>Revenue</th><th>Profit</th><th>Profit/g</th><th>Margin %</th></tr></thead>
                <tbody></tbody>
            </table>
        </div>
        <hr>
        <div class="section3-adjustments">
            <h4 class="section-title">Section 3: Adjustments</h4>
            <p class="input-caption">Add adjustment rows until Claimed = Actual</p>
            <table class="adjust-table">
                <thead><tr><th>#</th><th>Adjustment Type</th><th>From Purity</th><th>To Purity</th><th>Weight (g)</th><th>Notes / Remarks</th><th>Profit Impact</th><th>Delete</th></tr></thead>
                <tbody></tbody>
            </table>
            <button class="add-adjustment-btn btn-adjustment">+ Add Adjustment</button>
            <button class="save-adjustments-btn btn-save-green">Save All Adjustments</button>
        </div>
        <hr>
        <div class="recon-action-buttons">
            <button class="back-to-sale-btn btn-back">← Back to Sale Details</button>
            <button class="save-continue-btn btn-save-green">Save & Continue to Payments →</button>
        </div>
    `);

    // Call three section renders to fill tbody's
    this.renderReceiptSection();
    this.renderReconciliationSection();
    this.renderAdjustmentsSection();
  }

  renderReceiptSection() {
    const purities = this.availablePurities;
    // FIRST TIME → EMPTY TABLE
    if (!this.bagSummary || this.bagSummary.length === 0) {
      this.container.find(".section1-buyer-receipt table.receipt-table tbody")
        .html(`
        <tr class="footer-total">
            <td colspan="2">TOTAL</td>
            <td class="total-weight">0.00 g</td>
            <td>-</td>
            <td class="total-amount">RM 0.00</td>
            <td></td>
        </tr>
    `);
      return;
    }

    // Helper to build options html
    const purityOptions = (selected) => {
      const blankOption = `<option value="" ${
        selected === "" ? "selected" : ""
      } disabled>Select</option>`;
      const otherOptions = purities
        .map(
          (p) =>
            `<option value="${p}" ${
              p === selected ? "selected" : ""
            }>${p}</option>`
        )
        .join("");
      return blankOption + otherOptions;
    };

    const receiptLines = this.bagSummary
      .map(
        (r, idx) => `
            <tr data-idx="${idx}">
                <td><span class="move-arrows"><span class="up-arrow">&#9650;</span><span class="down-arrow">&#9660;</span></span></td>
             <td>
  <input list="purity-list-${idx}" class="input-purity" value="${r.purity}">
  <datalist id="purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                <td><input type="number" class="input-weight" value="${
                  r.weight ? r.weight.toFixed(2) : "0.00"
                }" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-rate" value="${
                  r.rate ? r.rate.toFixed(2) : "0.00"
                }" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-amount" value="${
                  r.amount ? r.amount.toFixed(2) : "0.00"
                }" data-purity="${r.purity}"></td>
                <td><button class="delete-row-btn" data-idx="${idx}">&#128465;</button></td>
            </tr>
        `
      )
      .join("");

    const receiptTable = this.container.find(
      ".section1-buyer-receipt table.receipt-table tbody"
    );
    if (receiptTable.length) {
      receiptTable.html(`${receiptLines}
            <tr class="footer-total">
                <td colspan="2">TOTAL</td>
                <td class="total-weight">0.00 g</td>
                <td>-</td>
                <td class="total-amount">RM 0.00</td>
                <td></td>
            </tr>`);
    } else {
      // Initial render case - call full render to set HTML first
      this.render();
    }
  }

  renderReconciliationSection() {
    const reconRows = this.reconSummary
      .map(
        (r) => `
            <tr data-idx="${r.purity}" data-purity="${r.purity}">
                <td>${r.purity}</td>
                <td class="actual-cell text-yellow">${r.actual.toFixed(2)}</td>
                <td class="claimed-cell text-yellow">${(r.claimed || 0).toFixed(
                  2
                )}</td>
                <td class="delta-cell text-yellow">${(
                  r.actual - r.claimed
                ).toFixed(2)}</td>
                <td class="status-cell text-yellow"><span class="status-icon info">&#9432;</span></td>
                <td class="cost-basis text-yellow">RM ${(
                  r.cost_basis || 0
                ).toLocaleString("en-MY", {
                  minimumFractionDigits: 2,
                })}</td>
                <td class="revenue-cell text-yellow">RM ${(
                  r.revenue || 0
                ).toLocaleString("en-MY", {
                  minimumFractionDigits: 2,
                })}</td>
                <td class="profit-cell text-yellow">RM ${r.profit.toLocaleString(
                  "en-MY",
                  {
                    minimumFractionDigits: 2,
                  }
                )}</td>
                <td class="profit-g-cell text-yellow">RM ${(
                  r.profit_g || 0
                ).toLocaleString("en-MY", {
                  minimumFractionDigits: 2,
                })}</td>
                <td class="margin-cell text-yellow">${(
                  r.margin_percent || 0
                ).toFixed(1)}%</td>
            </tr>
        `
      )
      .join("");

    this.container
      .find(".section2-recon-summary table.recon-table tbody")
      .html(reconRows);
  }

  renderAdjustmentsSection() {
    const adjustmentOptions = [
      "Purity Change",
      "Weight Loss - Torching/Cleaning",
      "Weight Adjustment - Stones",
      "Weight Loss - Other",
      "Purity Blend (Melting)",
      "Item Return",
    ];
    const section = this.container.find(".section3-adjustments");
    const tbody = section.find("tbody");

    tbody.empty();
    const purities = this.availablePurities; // get fresh purity list

    // 1️⃣ First load ADJUSTMENTS FROM DB
    if (this.adjustments && this.adjustments.length > 0) {
      this.adjustments.forEach((adj, idx) => {
        const optionHTML = adjustmentOptions
          .map(
            (o) =>
              `<option value="${o}" ${
                o === adj.type ? "selected" : ""
              }>${o}</option>`
          )
          .join("");

        const row = $(`
            <tr data-idx="${idx + 1}">
                <td>${idx + 1}</td>
                <td class="adjustment-type-cell">
                    <div class="adjustment-controls">
                        <select class="adjust-type">${optionHTML}</select>
                        <button class="btn-create-purity" title="Create New Purity">+</button>
                    </div>
                </td>

                <td>
                    <input list="from-purity-list-${
                      idx + 1
                    }" class="from-purity" value="${adj.from_purity}">
                    <datalist id="from-purity-list-${idx + 1}">
                        ${purities.map((p) => `<option value="${p}">`).join("")}
                    </datalist>
                </td>

                <td>
                    <input list="to-purity-list-${
                      idx + 1
                    }" class="to-purity" value="${adj.to_purity}">
                    <datalist id="to-purity-list-${idx + 1}">
                        ${purities.map((p) => `<option value="${p}">`).join("")}
                    </datalist>
                </td>

                <td><input type="number" class="weight" value="${
                  adj.weight
                }" /></td>
                <td><input type="text" class="notes" value="${
                  adj.notes
                }" /></td>
                <td class="profit-impact text-success">${adj.impact}</td>
                <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
            </tr>
        `);

        tbody.append(row);
      });
    }

    const addRow = () => {
      const idx = tbody.children().length + 1;
      const optionHTML = adjustmentOptions
        .map((o) => `<option value="${o}">${o}</option>`)
        .join("");

      const row = $(`
                <tr data-idx="${idx}">
                    <td>${idx}</td>
					<td class="adjustment-type-cell">
            <div class="adjustment-controls">
                <select class="adjust-type">${optionHTML}</select>
                <button class="btn-create-purity" title="Create New Purity">+</button>
            </div>
        </td>
                    <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                    <td><input type="number" class="weight" placeholder="0" /></td>
                    <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
                    <td class="profit-impact text-success">+RM 0.00</td>
                    <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
                </tr>
            `);
      tbody.append(row);
      // update the impact display for this freshly-added row
      this.computeProfitImpactForRow(tbody.find("tr").last());
    };
    // If NO existing adjustments → Add 1 empty row

    section
      .find(".add-adjustment-btn")
      .off("click")
      .on("click", () => {
        const tbody = section.find("tbody");
        const idx = tbody.children().length + 1;
        const optionHTML = adjustmentOptions
          .map((o) => `<option value="${o}">${o}</option>`)
          .join("");
        const purities = this.availablePurities;
        const row = $(`
        <tr data-idx="${idx}">
            <td>${idx}</td>
			 <td class="adjustment-type-cell">
            <div class="adjustment-controls">
                <select class="adjust-type">${optionHTML}</select>
               <button class="btn-create-purity" title="Create New Purity">+</button>
            </div>
        </td>
            <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

            <td><input type="number" class="weight" placeholder="0" /></td>
            <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
            <td class="profit-impact text-success">+RM 0.00</td>
            <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
        </tr>
    `);
        tbody.append(row);
        this.bindAdjustmentEvents();
        this.updateReconciliationSummary();
      });

    tbody
      .off("click", ".btn-delete-row")
      .on("click", ".btn-delete-row", function () {
        $(this).closest("tr").remove();
        tbody.find("tr").each((i, tr) =>
          $(tr)
            .find("td:first")
            .text(i + 1)
        );
      });

    section
      .find(".save-adjustments-btn")
      .off("click")
      .on("click", () => {
        const adjustments = [];
        tbody.find("tr").each((_, tr) => {
          const row = $(tr);
          adjustments.push({
            type: row.find(".adjust-type").val(),
            from_purity: row.find(".from-purity").val(),
            to_purity: row.find(".to-purity").val(),
            weight: row.find(".weight").val(),
            notes: row.find(".notes").val(),
            impact: row.find(".profit-impact").text(),
          });
        });

        this.adjustments = adjustments;

        const hasPurityBlend = adjustments.some(
          (adj) => adj.type === "Purity Blend (Melting)"
        );

        if (!this.isFullyReconciled() && !hasPurityBlend) {
          frappe.msgprint({
            title: "Reconciliation Incomplete",
            message:
              "Please complete reconciliation (Δ = 0) for all purities before saving.",
            indicator: "orange",
          });
          return;
        }

        this.onClickSaveAdjustments();

        frappe.show_alert({
          message: hasPurityBlend
            ? "Adjustments saved (Purity Blend entries will be handled separately)."
            : "Adjustments saved successfully.",
          indicator: "green",
        });
      });

    // After "addRow();" and after setting up existing handlers:

    // Handler for ANY adjustment value changes (type, from_purity, weight)
    // canonical single handler for adjustment input changes
    tbody
      .off("input.adjust-update")
      .on("input.adjust-update", "input,select", (e) => {
        const $changedRow = $(e.currentTarget).closest("tr");
        // Compute impact only for changed row
        this.computeProfitImpactForRow($changedRow);

        // Update adjustments array fully after change
        this.adjustments = [];
        tbody.find("tr").each((_, tr) => {
          const $tr = $(tr);
          this.adjustments.push({
            type: $tr.find(".adjust-type").val(),
            from_purity: $tr.find(".from-purity").val(),
            to_purity: $tr.find(".to-purity").val(),
            weight: $tr.find(".weight").val(),
            notes: $tr.find(".notes").val(),
            impact: $tr.find(".profit-impact").text(),
          });
        });

        // Update reconciliation summary
        this.updateReconciliationSummary();
      });

    // Function to toggle visibility of 'To Purity' field in a given row based on selected adjustment type
    const toggleToPurityField = (row) => {
      const adjustmentType = row.find(".adjust-type").val();
      const toPurityInput = row.find(".to-purity");
      const fromPurityInput = row.find(".from-purity");
      if (adjustmentType === "Item Return") {
        toPurityInput.val("").hide().prop("readonly", false);
      } else if (
        adjustmentType === "Weight Loss - Torching/Cleaning" ||
        adjustmentType === "Weight Loss - Other" ||
        adjustmentType === "Weight Adjustment - Stones"
      ) {
        toPurityInput.show().prop("readonly", true);
        toPurityInput.val(fromPurityInput.val());
      } else {
        toPurityInput.show().prop("readonly", false);
      }
    };

    // Initial toggle on all existing rows
    tbody.find("tr").each((_, tr) => {
      toggleToPurityField($(tr));
    });

    // Event handler for change on adjustment type select dropdown
    tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
      const row = $(e.currentTarget).closest("tr");
      const selectedType = $(e.currentTarget).val();
      const createPurityBtn = row.find(".btn-create-purity");

      // NEW: Show/hide Create Purity button based on selection
      if (selectedType === "Purity Blend (Melting)") {
        createPurityBtn.show();
      } else {
        createPurityBtn.hide();
      }

      toggleToPurityField(row);
      // Same as above: refresh adjustments and update recon
      this.adjustments = [];
      tbody.find("tr").each((_, tr) => {
        const row = $(tr);
        this.adjustments.push({
          type: row.find(".adjust-type").val(),
          from_purity: row.find(".from-purity").val(),
          to_purity: row.find(".to-purity").val(),
          weight: row.find(".weight").val(),
          notes: row.find(".notes").val(),
          impact: row.find(".profit-impact").text(),
        });
      });
      this.updateReconciliationSummary();
    });

    // NEW: Event handler for Create Purity button click
    tbody
      .off("click", ".btn-create-purity")
      .on("click", ".btn-create-purity", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showCreatePurityDialog();
      });

    // Real-time sync from_purity to to_purity for weight loss rows
    tbody.on("input", ".from-purity", function () {
      const row = $(this).closest("tr");
      const adjustmentType = row.find(".adjust-type").val();
      if (
        adjustmentType === "Weight Loss - Torching/Cleaning" ||
        adjustmentType === "Weight Loss - Other" ||
        adjustmentType === "Weight Adjustment - Stones"
      ) {
        row.find(".to-purity").val($(this).val());
      }
    });

    section.find(".profit-impact").each((_, el) => {
      const $cell = $(el);
      const txt = ($cell.text() || "").trim();

      $cell.removeClass("text-success text-danger");

      if (txt.startsWith("+")) {
        $cell.addClass("text-success");
      } else if (txt.startsWith("-")) {
        $cell.addClass("text-danger");
      }
    });
  }

  attachNavHandlers() {
    this.container.find(".back-to-sale-btn").on("click", this.backCallback);
    this.container
      .find(".save-continue-btn")
      .off("click")
      .on("click", async () => {
        try {
          await this.callCreateSalesAndDeliveryAPI();
          frappe.show_alert({
            message: "Sales and Delivery created successfully",
            indicator: "green",
          });
          if (this.continueCallback) this.continueCallback();
        } catch (error) {
          frappe.msgprint({
            title: "Error",
            message: `Failed to create sales and delivery: ${error.message}`,
            indicator: "red",
          });
        }
      });
  }

  bindReceiptEvents() {
    const container = this.container;

    container
      .find(".add-receipt-line-btn")
      .off("click")
      .on("click", () => {
        const newRow = {
          purity: "",
          weight: 0,
          rate: 0,
          amount: 0,
        };
        this.bagSummary.push(newRow);
        this.renderReceiptSection();
        this.bindReceiptEvents(); // Re-bind receipt events
        this.updateReconciliationSummary();
      });

    container.on("click", ".delete-row-btn", (e) => {
      const idx = $(e.currentTarget).data("idx");
      this.bagSummary.splice(idx, 1); // Remove from data array

      $(e.currentTarget).closest("tr").remove();

      this.renderReceiptSection();
      this.bindReceiptEvents();
      this.updateReconciliationSummary();
    });

    // Purity field event handler
    container.on("input", ".input-purity", (e) => {
      const row = $(e.currentTarget).closest("tr");
      const idx = row.data("idx");
      this.bagSummary[idx].purity = $(e.currentTarget).val();
    });

    container
      .find(".input-weight, .input-rate, .input-amount")
      .on("blur", (e) => {
        const row = $(e.currentTarget).closest("tr");
        const idx = row.index();

        let weight = parseFloat(row.find(".input-weight").val()) || 0;
        let rate = parseFloat(row.find(".input-rate").val()) || 0;
        let amount = parseFloat(row.find(".input-amount").val()) || 0;
        const inputClass = $(e.currentTarget).attr("class");

        if (
          inputClass.includes("input-weight") &&
          !inputClass.includes("input-amount")
        ) {
          if (rate > 0) {
            amount = weight * rate;
          } else if (amount > 0 && weight > 0) {
            rate = amount / weight;
          } else {
            amount = 0;
            rate = 0;
          }
        } else if (
          inputClass.includes("input-rate") &&
          !inputClass.includes("input-amount")
        ) {
          if (weight > 0) {
            amount = weight * rate;
          } else if (amount > 0 && rate > 0) {
            weight = amount / rate;
          } else {
            amount = 0;
            weight = 0;
          }
        } else if (inputClass.includes("input-amount")) {
          if (weight > 0) {
            rate = amount / weight;
          } else if (rate > 0) {
            weight = amount / rate;
          } else {
            weight = 0;
            rate = 0;
          }
        }

        // Format on blur: always to 2 decimals
        row.find(".input-weight").val(weight.toFixed(2));
        row.find(".input-rate").val(rate.toFixed(2));
        row.find(".input-amount").val(amount.toFixed(2));

        if (this.bagSummary[idx]) {
          this.bagSummary[idx].weight = weight;
          this.bagSummary[idx].rate = rate;
          this.bagSummary[idx].amount = amount;
        }

        let totalWeight = 0,
          totalAmount = 0;
        this.bagSummary.forEach((r) => {
          totalWeight += r.weight || 0;
          totalAmount += r.amount || 0;
        });

        container
          .find(".receipt-table .footer-total .total-weight")
          .text(`${totalWeight.toFixed(2)} g`);
        container
          .find(".receipt-table .footer-total .total-amount")
          .text(`RM ${totalAmount.toFixed(2)}`);
        this.updateReconciliationSummary();
      });

    container.find(".input-weight, .input-amount").on("input", (e) => {
      const row = $(e.currentTarget).closest("tr");
      const idx = row.index();

      let weight = parseFloat(row.find(".input-weight").val()) || 0;
      let amount = parseFloat(row.find(".input-amount").val()) || 0;

      if (weight > 0 && amount > 0) {
        const rate = amount / weight;
        row.find(".input-rate").val(rate.toFixed(2));
        if (this.bagSummary[idx]) {
          this.bagSummary[idx].rate = rate;
        }
      } else {
        row.find(".input-rate").val("0.00");
        if (this.bagSummary[idx]) {
          this.bagSummary[idx].rate = 0;
        }
      }
    });

    container.on("input", ".input-weight, .input-amount", () => {
      let totalWeight = 0,
        totalAmount = 0;
      container.find(".receipt-table tbody tr").each(function () {
        const weight = parseFloat($(this).find(".input-weight").val()) || 0;
        const amount = parseFloat($(this).find(".input-amount").val()) || 0;
        totalWeight += weight;
        totalAmount += amount;
      });

      container
        .find(".receipt-table .footer-total .total-weight")
        .text(`${totalWeight.toFixed(2)} g`);
      container
        .find(".receipt-table .footer-total .total-amount")
        .text(`RM ${totalAmount.toFixed(2)}`);
    });

    container
      .find(".up-arrow, .down-arrow")
      .off("click")
      .on("click", (e) => {
        const isUp = $(e.currentTarget).hasClass("up-arrow");
        const row = $(e.currentTarget).closest("tr");
        if (isUp) {
          const prevRow = row.prev("tr");
          if (prevRow.length && !prevRow.hasClass("footer-total")) {
            row.insertBefore(prevRow);
          }
        } else {
          const nextRow = row.next("tr");
          if (nextRow.length && !nextRow.hasClass("footer-total")) {
            row.insertAfter(nextRow);
          }
        }
        const updatedSummary = [];
        container.find(".receipt-table tbody tr[data-idx]").each((i, tr) => {
          const idx = $(tr).data("idx");
          if (this.bagSummary[idx]) {
            updatedSummary.push(this.bagSummary[idx]);
          }
        });
        this.bagSummary = updatedSummary;
      });

    container
      .find(".save-continue-btn")
      .off("click")
      .on("click", async () => {
        const adjustments = this.adjustments || [];

        const hasPurityBlend = adjustments.some(
          (adj) => adj.type === "Purity Blend (Melting)"
        );
        const hasItemReturn = adjustments.some(
          (adj) => adj.type === "Item Return"
        );

        if (!this.isFullyReconciled() && !hasPurityBlend) {
          frappe.msgprint({
            title: "Reconciliation Incomplete",
            message:
              "Please complete reconciliation (Δ = 0) for all purities before continuing to payments.",
            indicator: "orange",
          });
          return;
        }

        try {
          if (hasPurityBlend) {
            await this.callCreateMaterialReceiptAPI();
          }
          if (hasItemReturn) {
            await this.callCreateItemReturnStockEntryAPI();
          }

          await this.callCreateSalesAndDeliveryAPI();

          frappe.show_alert({
            message: hasPurityBlend
              ? "Sales created successfully."
              : "Sales created successfully.",
            indicator: "green",
          });

          if (this.continueCallback) this.continueCallback();
        } catch (error) {
          frappe.msgprint({
            title: "Error",
            message: `Failed to complete Save & Continue: ${error.message}`,
            indicator: "red",
          });
        }
      });
  }

  updateReconciliationSummary() {
    const container = this.container;

    // Precompute adjustment weight maps by type (per purity)
    const itemReturnMap = {};
    const weightLossMap = {};
    const weightAdjustStonesMap = {};
    const purityChangeOutMap = {}; // weights moved out from a purity
    const purityChangeInMap = {}; // weights moved into a purity

    (this.adjustments || []).forEach((adj) => {
      const type = adj.type;
      const from = (adj.from_purity || "").trim();
      const to = (adj.to_purity || "").trim();
      const wt = parseFloat(adj.weight) || 0;

      if (!wt) return;

      if (type === "Item Return") {
        itemReturnMap[from] = (itemReturnMap[from] || 0) + wt;
      } else if (
        type === "Weight Loss - Torching/Cleaning" ||
        type === "Weight Loss - Other"
      ) {
        weightLossMap[from] = (weightLossMap[from] || 0) + wt;
      } else if (type === "Weight Adjustment - Stones") {
        weightAdjustStonesMap[from] = (weightAdjustStonesMap[from] || 0) + wt;
      } else if (
        type === "Purity Change" ||
        type === "Purity Blend (Melting)"
      ) {
        // For purity change, treat as moving wt from 'from' to 'to'
        purityChangeOutMap[from] = (purityChangeOutMap[from] || 0) + wt;
        purityChangeInMap[to] = (purityChangeInMap[to] || 0) + wt;
      }
    });

    // Build aggregated monetary impacts per purity (consistent with computeProfitImpactForRow)
    const adjustmentImpactMap = {}; // numeric RM adjustments per purity
    const { unit_revenue: __ur, unit_cost: __uc } = this.computeUnitMaps
      ? this.computeUnitMaps()
      : { unit_revenue: {}, unit_cost: {} };

    (this.adjustments || []).forEach((adj) => {
      const type = adj.type;
      const from = (adj.from_purity || "").trim();
      const to = (adj.to_purity || "").trim();
      const wt = parseFloat(adj.weight) || 0;
      if (!wt) return;

      const urFrom = (__ur && __ur[from]) || 0;
      const ucFrom = (__uc && __uc[from]) || 0;
      const urTo = (__ur && __ur[to]) || 0;
      const ucTo = (__uc && __uc[to]) || 0;

      let impactFrom = 0;
      let impactTo = 0;

      if (type === "Item Return") {
        impactFrom = -(urFrom - ucFrom) * wt;
        adjustmentImpactMap[from] =
          (adjustmentImpactMap[from] || 0) + impactFrom;
      } else if (
        type === "Weight Loss - Torching/Cleaning" ||
        type === "Weight Loss - Other"
      ) {
        impactFrom = -urFrom * wt;
        adjustmentImpactMap[from] =
          (adjustmentImpactMap[from] || 0) + impactFrom;
      } else if (type === "Weight Adjustment - Stones") {
        impactFrom = (urFrom - ucFrom) * wt;
        adjustmentImpactMap[from] =
          (adjustmentImpactMap[from] || 0) + impactFrom;
      } else if (type === "Purity Change") {
        // margin difference moved from => to
        const margin_from = urFrom - ucFrom;
        const margin_to = urTo - ucTo;
        const net = (margin_to - margin_from) * wt;
        // net is positive if moving increases overall margin, negative otherwise.
        // Allocate negative impact on 'from' and positive on 'to'
        impactFrom = -net; // remove margin from 'from' (show as negative)
        impactTo = net; // add margin to 'to'
        adjustmentImpactMap[to] = (adjustmentImpactMap[to] || 0) + impactTo;
      }
    });

    // Iterate receipt rows and update reconciliation table rows
    const rows = container.find(".receipt-table tbody tr[data-idx]");

    // For faster lookup, load recon rows by purity key
    const reconMap = {};
    container.find(".recon-table tbody tr[data-purity]").each((_, r) => {
      const $r = $(r);
      const p = ($r.data("purity") || "").toString().trim();
      if (p) reconMap[p] = $r;
    });

    // --- Ensure all 'to' purities from Purity Blend (Melting) exist in reconciliation table ---
    (this.adjustments || []).forEach((adj) => {
      const type = adj.type;
      if (type === "Purity Blend (Melting)") {
        const fromPurity = (adj.from_purity || "").trim();
        const toPurity = (adj.to_purity || "").trim();
        const addedWeight = parseFloat(adj.weight) || 0;

        if (!toPurity || !addedWeight) return;

        // If this purity doesn't exist yet, create a new row
        if (!reconMap[toPurity]) {
          const $tableBody = container.find(".recon-table tbody");
          const newRow = $(`
				<tr data-purity="${toPurity}">
					<td class="purity-cell">${toPurity}</td>
					<td class="actual-cell">0.00</td>
					<td class="claimed-cell">0.00</td>
					<td class="delta-cell">0.00</td>
					<td class="status-cell"><span class="status-icon warning">&#9888;</span></td>
					<td class="cost-basis">0.00</td>
					<td class="revenue-cell">RM 0.00</td>
					<td class="profit-cell">RM 0.00</td>
					<td class="profit-g-cell">RM 0.00</td>
					<td class="margin-cell">0.0%</td>
				</tr>
			`);
          newRow.attr("data-blend-row", "1");
          $tableBody.append(newRow);
          reconMap[toPurity] = newRow;

          // Copy cost basis and compute per-gram rate
          if (fromPurity && reconMap[fromPurity]) {
            const fromRow = reconMap[fromPurity];

            const fromCostBasis =
              parseFloat(
                fromRow
                  .find(".cost-basis")
                  .text()
                  .replace(/[^\d.-]/g, "")
              ) || 0;

            const fromClaimed =
              parseFloat(
                fromRow
                  .find(".claimed-cell")
                  .text()
                  .replace(/[^\d.-]/g, "")
              ) || 0;
          }
        }
      }
    });

    // We'll also update any recon rows that have no receipt row (e.g., a 'to' purity that only gets increased)
    // But first update based on receipt rows to get actual weights.
    rows.each((_, rowElem) => {
      const row = $(rowElem);
      const purityVal = (row.find(".input-purity").val() || "")
        .toString()
        .trim();
      const purity = purityVal || "";
      const weight = parseFloat(row.find(".input-weight").val()) || 0;
      const rate = parseFloat(row.find(".input-rate").val()) || 0;
      const amountInput = parseFloat(row.find(".input-amount").val());
      const amount = isNaN(amountInput) ? weight * rate : amountInput;

      if (!purity || !reconMap[purity]) return;

      const reconRow = reconMap[purity];
      let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

      // Apply adjustments affecting this purity:
      const itemReturnWeight = itemReturnMap[purity] || 0;
      const weightLoss = weightLossMap[purity] || 0;
      const weightAdjustStones = weightAdjustStonesMap[purity] || 0;
      const purityOut = purityChangeOutMap[purity] || 0; // moved out
      const purityIn = purityChangeInMap[purity] || 0; // moved in

      // Effective claimed = baseClaimed - out (item return + purity out + weight loss) + in (purity in + stones adjust)
      const claimed =
        baseClaimed -
        itemReturnWeight -
        weightLoss -
        purityOut +
        purityIn +
        weightAdjustStones;

      // Show strikethrough -> new claimed when it changed
      if (Math.abs(claimed - baseClaimed) > 0.0009) {
        // If claimed decreased show original -> new, likewise for increase
        reconRow
          .find(".claimed-cell")
          .html(
            `<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`
          );
      } else {
        reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
      }

      // Actual is the physical weight in Section 1 for this row
      const actual = weight;
      const delta = (actual - claimed).toFixed(2);

      // Cost basis read from UI (existing behavior)
      const baseCostBasis =
        parseFloat(
          reconRow
            .find(".cost-basis")
            .text()
            .replace(/[^\d.-]/g, "")
        ) || 0;

      // Compute revenue/profit,
      let revenue = 0,
        profit = 0,
        profitG = 0,
        margin = 0;
      let statusHTML = "";

      // When actual equals claimed and amount equals cost_basis (earlier logic)
      if (
        Math.abs(actual - claimed) < 0.001 &&
        Math.abs(amount - baseCostBasis) < 0.001
      ) {
        statusHTML = '<span class="status-icon success">&#10004;</span>';
        reconRow.addClass("recon-row-green");
      } else {
        revenue = amount;
        profit = revenue - baseCostBasis;

        // Apply aggregated adjustment impact for this purity (if any)
        const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
        profit += adjImpactForPurity;

        profitG = actual ? profit / actual : 0;
        margin = revenue ? (profit / revenue) * 100 : 0;

        const totalWeightAdjustments =
          itemReturnWeight +
          weightLoss +
          purityOut +
          weightAdjustStones -
          purityIn;
        // Adjust status logic conservatively: success if positive profit/g or revenue > cost (as before)
        if (Math.abs(delta) < 0.001) {
          statusHTML = '<span class="status-icon success">&#10004;</span>';
        } else {
          if (
            (profit > 0 && totalWeightAdjustments > 0) ||
            profitG > 0 ||
            revenue > baseCostBasis
          ) {
            statusHTML = '<span class="status-icon success">&#10004;</span>';
          } else {
            statusHTML = '<span class="status-icon warning">&#9888;</span>';
          }
        }
      }

      // Update reconciliation cells
      reconRow.find(".actual-cell").text(actual.toFixed(2));
      reconRow.find(".delta-cell").text(delta);
      reconRow
        .find(".revenue-cell")
        .text(
          `RM ${revenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`
        );
      reconRow
        .find(".profit-cell")
        .text(
          `RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`
        );
      reconRow
        .find(".profit-g-cell")
        .text(
          `RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`
        );
      reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
      reconRow.find(".status-cell").html(statusHTML);

      // --------------------------------------
      // FINAL COLOR LOGIC (text color only)
      // --------------------------------------
      const cellsToColor = reconRow.find(
        ".profit-cell, .profit-g-cell, .margin-cell, .delta-cell, .revenue-cell, .status-cell"
      );

      // remove previous color classes
      cellsToColor.removeClass("text-green text-red text-yellow");

      // apply new color based on profit
      if (profit > 0) {
        cellsToColor.addClass("text-green");
      } else if (profit < 0) {
        cellsToColor.addClass("text-red");
      } else {
        cellsToColor.addClass("text-yellow");
      }
    });

    // Additionally, update recon rows that are present in reconciliation table but not linked to a receipt row:
    // (these might be pure 'to' purities that just got increased)
    Object.keys(reconMap).forEach((purity) => {
      // if there is no receipt-row with this purity, still update the claimed to reflect purityChangeInMap
      const reconRow = reconMap[purity];
      const hasReceiptRow = !!container
        .find(`.receipt-table tbody tr[data-idx] .input-purity`)
        .filter(function () {
          return ($(this).val() || "").trim() === purity;
        }).length;

      if (!hasReceiptRow) {
        let baseClaimed =
          parseFloat(reconRow.find(".claimed-cell").text()) || 0;

        const purityIn = purityChangeInMap[purity] || 0;
        const purityOut = purityChangeOutMap[purity] || 0;
        const itemReturnWeight = itemReturnMap[purity] || 0;
        const weightLoss = weightLossMap[purity] || 0;
        const weightAdjustStones = weightAdjustStonesMap[purity] || 0;

        const claimed =
          baseClaimed -
          itemReturnWeight -
          weightLoss -
          purityOut +
          purityIn +
          weightAdjustStones;

        if (Math.abs(claimed - baseClaimed) > 0.0009) {
          reconRow
            .find(".claimed-cell")
            .html(
              `<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`
            );
        } else {
          reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
        }

        // For these, actual remains whatever existing value is (likely 0), so just update claimed and impacts
        const actual = parseFloat(reconRow.find(".actual-cell").text()) || 0;
        const delta = (actual - claimed).toFixed(2);

        let baseCostBasis =
          parseFloat(
            reconRow
              .find(".cost-basis")
              .text()
              .replace(/[^\d.-]/g, "")
          ) || 0;

        let revenue = 0,
          profit = 0,
          profitG = 0,
          margin = 0;
        let statusHTML = "";

        const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
        profit = revenue - baseCostBasis + adjImpactForPurity;
        profitG = actual ? profit / actual : 0;
        margin = revenue ? (profit / revenue) * 100 : 0;

        if (profit > 0 || profitG > 0) {
          statusHTML = '<span class="status-icon success">&#10004;</span>';
          reconRow.addClass("recon-row-green");
        } else {
          statusHTML = '<span class="status-icon warning">&#9888;</span>';
          reconRow.removeClass("recon-row-green");
        }

        reconRow.find(".delta-cell").text(delta);
        reconRow
          .find(".profit-cell")
          .text(
            `RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`
          );
        reconRow.find(".profit-g-cell").text(
          `RM ${profitG.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
          })}`
        );
        reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
        reconRow.find(".status-cell").html(statusHTML);

        // FINAL COLOR LOGIC (text color only)
        const cellsToColor = reconRow.find(
          ".profit-cell, .profit-g-cell, .margin-cell, .delta-cell, .revenue-cell, .status-cell"
        );

        cellsToColor.removeClass("text-green text-red text-yellow");

        if (profit > 0) {
          cellsToColor.addClass("text-green");
        } else if (profit < 0) {
          cellsToColor.addClass("text-red");
        } else {
          cellsToColor.addClass("text-yellow");
        }
      }
    });
  }

  bindAdjustmentEvents() {
    const tbody = this.container.find(".section3-adjustments tbody");

    tbody
      .off("click", ".btn-delete-row")
      .on("click", ".btn-delete-row", (e) => {
        $(e.currentTarget).closest("tr").remove();
        tbody.find("tr").each((i, tr) => {
          $(tr)
            .find("td:first")
            .text(i + 1);
        });
        this.updateReconciliationSummary();
      });

    tbody
      .off("input.adjust-update")
      .on("input.adjust-update", "input,select", (e) => {
        const $changedRow = $(e.currentTarget).closest("tr");
        // Compute impact only for changed row
        this.computeProfitImpactForRow($changedRow);

        // Update adjustments array fully after change
        this.adjustments = [];
        tbody.find("tr").each((_, tr) => {
          const $tr = $(tr);
          this.adjustments.push({
            type: $tr.find(".adjust-type").val(),
            from_purity: $tr.find(".from-purity").val(),
            to_purity: $tr.find(".to-purity").val(),
            weight: $tr.find(".weight").val(),
            notes: $tr.find(".notes").val(),
            impact: $tr.find(".profit-impact").text(),
          });
        });

        // Update reconciliation summary
        this.updateReconciliationSummary();
      });

    // UPDATED: Add Create Purity button logic here
    tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
      const row = $(e.currentTarget).closest("tr");
      const selectedType = $(e.currentTarget).val();
      const createPurityBtn = row.find(".btn-create-purity");

      // Show/hide Create Purity button based on selection
      if (selectedType === "Purity Blend (Melting)") {
        createPurityBtn.show();
      } else {
        createPurityBtn.hide();
      }

      this.toggleToPurityField(row);
      this.updateReconciliationSummary();
    });

    tbody.off("input", ".from-purity").on("input", ".from-purity", function () {
      const row = $(this).closest("tr");
      const adjustmentType = row.find(".adjust-type").val();
      if (
        [
          "Weight Loss - Torching/Cleaning",
          "Weight Loss - Other",
          "Weight Adjustment - Stones",
        ].includes(adjustmentType)
      ) {
        row.find(".to-purity").val($(this).val());
      }
    });
  }

  showCreatePurityDialog() {
    const dialog = new frappe.ui.Dialog({
      title: "Create New Purity",
      fields: [
        {
          label: "Purity Name",
          fieldname: "purity_name",
          fieldtype: "Data",
          reqd: 1,
          description: "Enter purity value (e.g., 916, 999, 750)",
        },
      ],
      primary_action_label: "Create",
      primary_action: async (values) => {
        const purityName = values.purity_name.trim();

        if (!purityName) {
          frappe.msgprint("Please enter a purity name");
          return;
        }

        // Check if purity already exists locally
        if (this.availablePurities.includes(purityName)) {
          frappe.msgprint({
            title: "Purity Exists",
            message: `Purity "${purityName}" already exists`,
            indicator: "orange",
          });
          return;
        }

        try {
          // Disable primary button and show loading
          dialog.get_primary_btn().prop("disabled", true).text("Creating...");

          // Call Python API to create purity
          const response = await frappe.call({
            method: "gold_app.api.sales.wholesale_warehouse.create_purity", // Adjust path to your API
            args: {
              purity_name: purityName,
            },
          });

          if (response.message && response.message.status === "success") {
            // Add to local array
            this.availablePurities.push(purityName);
            this.availablePurities.sort(); // Keep sorted

            // Refresh the adjustment section to update datalists
            this.updatePurityDatalistsOnly();

            frappe.show_alert({
              message: `Purity "${purityName}" created successfully`,
              indicator: "green",
            });

            dialog.hide();
          } else {
            throw new Error("Unexpected response from server");
          }
        } catch (error) {
          console.error("Error creating purity:", error);

          let errorMsg = "Unknown error";
          if (error.message) {
            errorMsg = error.message;
          } else if (error._server_messages) {
            try {
              const messages = JSON.parse(error._server_messages);
              errorMsg = messages.map((m) => JSON.parse(m).message).join(", ");
            } catch (e) {
              errorMsg = error._server_messages;
            }
          }

          frappe.msgprint({
            title: "Error",
            message: `Failed to create purity: ${errorMsg}`,
            indicator: "red",
          });

          // Re-enable button and restore label
          dialog.get_primary_btn().prop("disabled", false).text("Create");
        }
      },
    });

    dialog.show();
  }

  updatePurityDatalistsOnly() {
    const section = this.container.find(".section3-adjustments");
    const tbody = section.find("tbody");
    const purities = this.availablePurities;

    // Update each row's datalist options
    tbody.find("tr").each((_, tr) => {
      const $row = $(tr);
      const idx = $row.data("idx");

      // Update "From Purity" datalist
      const fromDatalist = $row.find(`#from-purity-list-${idx}`);
      if (fromDatalist.length) {
        fromDatalist.html(
          purities.map((p) => `<option value="${p}">`).join("")
        );
      }

      // Update "To Purity" datalist
      const toDatalist = $row.find(`#to-purity-list-${idx}`);
      if (toDatalist.length) {
        toDatalist.html(purities.map((p) => `<option value="${p}">`).join(""));
      }
    });
  }

  isFullyReconciled() {
    let reconciled = true;
    this.container.find(".recon-table tbody tr").each((_, tr) => {
      const delta = parseFloat($(tr).find(".delta-cell").text());
      // ONLY check delta value now
      if (Math.abs(delta) > 0.001) {
        reconciled = false;
        return false; // exit loop early if any row fails
      }
    });
    return reconciled;
  }

  async callCreateSalesAndDeliveryAPI() {
    if (!this.props.customer) {
      throw new Error("Customer info missing.");
    }

    const warehouse = this.props.selected_bag + " - AGSB";
    const items = this.salesDetailData.map((line) => ({
      item_code: `Unsorted-${line.purity || ""}`,
      purity: line.purity || "",
      weight: parseFloat(line.weight) || 0,
      rate: parseFloat(line.rate) || 0,
      warehouse: warehouse,
    }));

    const payload = {
      customer: this.props.customer,
      items: JSON.stringify(items),
      company: this.props.company || null,
    };

    console.log("Calling create_sales_invoice API with payload:", payload);

    const r = await frappe.call({
      method: "gold_app.api.sales.wholesale_warehouse.create_sales_invoice",
      args: payload,
    });

    if (!(r.message && r.message.status === "success")) {
      throw new Error("API returned failure");
    }

    const invoiceRef = r.message.sales_invoice;
    console.log("Sales Invoice Created:", invoiceRef);

    // ⭐ CLEANEST WAY → Store invoice in Wholesale Transaction
    await frappe.call({
      method: "gold_app.api.sales.wholesale_warehouse.update_sales_invoice_ref",
      args: {
        wholesale_bag: this.props.selected_bag,
        buyer: this.props.customer,
        invoice_ref: invoiceRef,
      },
    });

    frappe.show_alert("Invoice linked to Wholesale Transaction");

    // Send invoiceRef to step controller only if you need
    if (this.onSalesInvoiceCreated) {
      this.onSalesInvoiceCreated(invoiceRef);
    }

    return invoiceRef;
  }

  async callCreateMaterialReceiptAPI() {
    try {
      // Collect Purity Blend (Melting) items
      const items = [];
      (this.adjustments || []).forEach((adj) => {
        const type = adj.type;
        if (type === "Purity Blend (Melting)") {
          const toPurity = (adj.to_purity || "").trim();
          const addedWeight = parseFloat(adj.weight) || 0;

          if (!toPurity || !addedWeight) return;

          // Get cost basis and actual weight for this purity
          const row = this.container.find(
            `.recon-table tr[data-purity='${toPurity}']`
          );
          const costBasis = parseFloat(row.find(".cost-basis").text()) || 0;
          const actualWeight = parseFloat(row.find(".actual-cell").text()) || 0;

          // Try getting pre-stored per-gram rate
          let basicRate = parseFloat(row.data("per-gram-rate")) || 0;

          // If not found, fallback calculation
          if (!basicRate && actualWeight > 0) {
            basicRate = costBasis / actualWeight;
          }

          items.push({
            purity: toPurity,
            qty: addedWeight,
          });
        }
      });

      console.log("Material Receipt Items:", items);

      if (items.length === 0) {
        console.log("No Purity Blend items found to create stock entry.");
        return;
      }

      // Call backend API to create Stock Entry
      await frappe.call({
        method:
          "gold_app.api.sales.wholesale_warehouse.create_material_receipt",
        args: { items, to_warehouse: this.selected_bag },
        freeze: true,
        callback: (r) => {
          if (r.message) {
            frappe.show_alert({
              message: `Stock Entry Created: ${r.message.stock_entry_name}`,
              indicator: "green",
            });
          }
        },
      });
    } catch (error) {
      console.error("Error creating Material Receipt:", error);
      frappe.msgprint({
        title: "Error",
        message: `Failed to create Material Receipt: ${error.message}`,
        indicator: "red",
      });
    }
  }

  getRateFromBagSummary(purity) {
    const item = this.bagSummary.find((r) => r.purity === purity);
    return item ? item.rate || 0 : 0;
  }

  async callCreateItemReturnStockEntryAPI() {
    try {
      const itemReturnItems = [];
      (this.adjustments || []).forEach((adj) => {
        if (adj.type === "Item Return") {
          const fromPurity = adj.from_purity.trim();
          const weight = parseFloat(adj.weight) || 0;
          if (!fromPurity || weight === 0) return;

          const basicRate = this.getRateFromBagSummary(fromPurity);

          itemReturnItems.push({
            purity: fromPurity,
            qty: weight,
            basic_rate: basicRate,
          });
        }
      });

      if (itemReturnItems.length === 0) {
        console.log("No Item Return items found to create stock entry.");
        return;
      }

      await frappe.call({
        method:
          "gold_app.api.sales.wholesale_warehouse.create_item_return_stock_entry",
        args: { items: itemReturnItems, to_warehouse: this.selected_bag },
        freeze: true,
        freeze_message: "Creating Item Return Stock Entry...",
        callback: (r) => {
          if (r.message) {
            frappe.show_alert({
              message: `Item Return Stock Entry Created: ${r.message.stock_entry_name}`,
              indicator: "green",
            });
          }
        },
      });
    } catch (error) {
      console.error("Error creating Item Return Stock Entry:", error);
      frappe.msgprint({
        title: "Error",
        message: `Failed to create Item Return Stock Entry: ${error.message}`,
        indicator: "red",
      });
    }
  }

  bindUploadReceipt() {
    const container = this.container;
    if (container.find("#hidden-upload-input").length === 0) {
      const fileInput = $(
        '<input type="file" id="hidden-upload-input" style="display:none" />'
      );
      container.append(fileInput);
      fileInput.on("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        this.pendingReceiptFile = file; // Save the file object for later
        frappe.show_alert({
          message: `Receipt "${file.name}" selected, will be uploaded on Save.`,
          indicator: "green",
        });
      });
    }
    container
      .find(".btn-upload-receipt")
      .off("click")
      .on("click", () => {
        container.find("#hidden-upload-input").click();
      });
  }

  uploadReceiptFile(transactionName) {
    if (!this.pendingReceiptFile) return;
    const file = this.pendingReceiptFile;
    const reader = new FileReader();
    reader.onload = (ev) => {
      frappe.call({
        method: "frappe.client.attach_file",
        args: {
          doctype: "Wholesale Transaction",
          docname: transactionName, // now the valid docname!
          filedata: ev.target.result.split(",")[1],
          filename: file.name,
          is_private: 1,
        },
        callback: (r) => {
          if (r.message && r.message.file_url) {
            // Update the transaction's upload_receipt field after attaching
            frappe.call({
              method: "frappe.client.set_value",
              args: {
                doctype: "Wholesale Transaction",
                name: transactionName,
                fieldname: "upload_receipt",
                value: r.message.file_url,
              },
              callback: () => {
                frappe.show_alert({
                  message: "Receipt file linked successfully!",
                  indicator: "green",
                });
              },
            });
          }
        },
      });
    };
    reader.readAsDataURL(file);
  }

  onClickSaveAdjustments() {
    // Always fetch existing transaction for (bag + buyer)
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Wholesale Transaction",
        filters: {
          wholesale_bag: this.props.selected_bag,
          buyer: this.props.customer,
        },
        fields: ["name"],
        limit: 1,
      },
      callback: (res) => {
        if (!res.message || res.message.length === 0) {
          frappe.msgprint(
            "No existing Wholesale Transaction found for this Bag & Buyer. Please return to Step 2 and save buyer details first."
          );
          return;
        }

        const docname = res.message[0].name;
        console.log("Updating existing Wholesale Transaction:", docname);

        // ⭐ STEP 1 — Fetch full document first (to load avg_rate)
        frappe.call({
          method: "frappe.client.get",
          args: { doctype: "Wholesale Transaction", name: docname },
          callback: (docRes) => {
            if (!docRes.message) {
              frappe.msgprint("Failed to fetch transaction.");
              return;
            }

            const existingDoc = docRes.message;

            // ⭐ STEP 2 — Build avgRateMap from existing reconciliation_lines
            const avgRateMap = {};
            (existingDoc.reconciliation_lines || []).forEach((row) => {
              if (row && row.purity) {
                avgRateMap[row.purity] = parseFloat(row.avg_rate) || 0;
              }
            });

            // ----------------------------------------------------
            // Build updated fields (your original logic)
            // ----------------------------------------------------
            let updatedData = {
              total_cost_basis: this.props.totalAmount,

              // ✔ You WANT to update receipt_lines → keep it here
              receipt_lines: this.bagSummary.map((line) => ({
                purity: line.purity,
                weight: line.weight,
                rate: line.rate,
                amount: line.amount,
              })),

              reconciliation_lines: [],
              adjustments: this.adjustments.map((adj) => ({
                adjustment_type: adj.type,
                from_purity: adj.from_purity,
                to_purity: adj.to_purity,
                weight: adj.weight,
                notes: adj.notes,
                profit_impact: adj.impact,
              })),
            };

            // ----------------------------------------------------
            // Build reconciliation_lines from UI
            // ----------------------------------------------------
            this.container.find(".recon-table tbody tr").each((_, tr) => {
              const $tr = $(tr);
              const purity = $tr.find("td:eq(0)").text().trim();

              updatedData.reconciliation_lines.push({
                purity: purity,
                actual: parseFloat($tr.find(".actual-cell").text()) || 0,
                claimed: parseFloat($tr.find(".claimed-cell").text()) || 0,
                delta: parseFloat($tr.find(".delta-cell").text()) || 0,
                status: $tr.find(".status-cell").text().trim() || "",

                // ⭐ PRESERVE EXISTING avg_rate (critical fix)
                avg_rate: avgRateMap[purity] || 0,

                cost_basis:
                  parseFloat(
                    $tr
                      .find(".cost-basis")
                      .text()
                      .replace(/[^\d\.-]/g, "")
                  ) || 0,

                revenue:
                  parseFloat(
                    $tr
                      .find(".revenue-cell")
                      .text()
                      .replace(/[^\d\.-]/g, "")
                  ) || 0,

                profit:
                  parseFloat(
                    $tr
                      .find(".profit-cell")
                      .text()
                      .replace(/[^\d\.-]/g, "")
                  ) || 0,

                profit_g:
                  parseFloat(
                    $tr
                      .find(".profit-g-cell")
                      .text()
                      .replace(/[^\d\.-]/g, "")
                  ) || 0,

                margin_percent:
                  parseFloat($tr.find(".margin-cell").text()) || 0,
              });
            });

            // ----------------------------------------------------
            // Your existing total profit calculations
            // ----------------------------------------------------
            let totalProfit = 0;
            let totalActualWeight = 0;

            (updatedData.reconciliation_lines || []).forEach((row) => {
              const p = parseFloat(row.profit) || 0;
              const w = parseFloat(row.actual) || 0;
              totalProfit += p;
              totalActualWeight += w;
            });

            const totalProfitPerG =
              totalActualWeight !== 0 ? totalProfit / totalActualWeight : 0;

            const formattedTotalProfit =
              (totalProfit >= 0 ? "+" : "") + totalProfit.toFixed(2);

            const formattedTotalProfitPerG =
              (totalProfitPerG >= 0 ? "+" : "") + totalProfitPerG.toFixed(2);

            updatedData.total_profit = formattedTotalProfit;
            updatedData.total_profit_per_g = formattedTotalProfitPerG;
            updatedData.total_actual_weight = parseFloat(
              totalActualWeight.toFixed(3)
            );

            // ----------------------------------------------------
            // Save back into doc (your original logic)
            // ----------------------------------------------------
            Object.assign(existingDoc, updatedData);

            frappe.call({
              method: "frappe.client.save",
              args: { doc: existingDoc },
              callback: () => {
                frappe.show_alert({
                  message: "Wholesale Transaction updated successfully.",
                  indicator: "green",
                });
                this.uploadReceiptFile(docname);
              },
              error: (e) => {
                frappe.msgprint("Update failed: " + (e.message || e));
              },
            });
          },
        });
      },
      error: (e) => {
        frappe.msgprint("Error searching for transaction: " + (e.message || e));
      },
    });
  }

  computeUnitMaps() {
    const unit_revenue = {};
    const unit_cost = {};

    // Build unit_revenue from receipt-table rows
    this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
      const $tr = $(tr);
      const purity = ($tr.find(".input-purity").val() || "").trim();
      const w = parseFloat($tr.find(".input-weight").val()) || 0;
      const a = parseFloat($tr.find(".input-amount").val()) || 0;
      if (purity && w > 0) {
        // If multiple rows for same purity, last one will overwrite; acceptable for simplicity.
        unit_revenue[purity] = a / w;
      }
    });

    // Build unit_cost from reconSummary (use DOM cost-basis cell as source of truth)
    this.container.find(".recon-table tbody tr[data-purity]").each((_, tr) => {
      const $tr = $(tr);
      const purity = $tr.data("purity");
      const claimed =
        parseFloat(
          $tr
            .find(".claimed-cell")
            .text()
            .replace(/[^\d.-]/g, "")
        ) || 0;
      const costText = $tr
        .find(".cost-basis")
        .text()
        .replace(/[^\d.-]/g, "");
      const cost = parseFloat(costText) || 0;
      if (purity && claimed > 0) {
        unit_cost[purity] = cost / claimed;
      } else {
        unit_cost[purity] = 0;
      }
    });

    return { unit_revenue, unit_cost };
  }

  computeProfitImpactForRow($row) {
    const type = $row.find(".adjust-type").val();
    const from = ($row.find(".from-purity").val() || "").trim();
    const weight = parseFloat($row.find(".weight").val()) || 0;

    // For Item Return, always show 0
    if (type === "Item Return") {
      $row
        .find(".profit-impact")
        .text("RM 0.00")
        .removeClass("text-danger text-success");
      return 0;
    }

    // Get current rate (RM/g) for the from_purity
    let currentRate = 0;
    this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
      const $tr = $(tr);
      const purity = ($tr.find(".input-purity").val() || "").trim();
      if (purity === from) {
        const rowWeight = parseFloat($tr.find(".input-weight").val()) || 0;
        const rowAmount = parseFloat($tr.find(".input-amount").val()) || 0;
        if (rowWeight > 0) {
          currentRate = rowAmount / rowWeight; // RM/g
        }
      }
    });

    // Calculate impact = Rate × Weight
    const impact = currentRate * weight;

    // Update UI cell styling and text
    const $impactCell = $row.find(".profit-impact");

    let displayText = "";

    if (type === "Weight Adjustment - Stones") {
      displayText = `+RM ${impact.toFixed(2)}`;
    } else {
      displayText = `-RM ${impact.toFixed(2)}`;
    }

    $impactCell.text(displayText);

    // ---- Set color based on text sign (+ / -)
    $impactCell.removeClass("text-success text-danger");

    const txt = displayText.trim();
    if (txt.startsWith("+")) {
      $impactCell.addClass("text-success");
    } else if (txt.startsWith("-")) {
      $impactCell.addClass("text-danger");
    }

    // Return signed numeric value (negative for losses, positive for stones)
    return type === "Weight Adjustment - Stones" ? impact : -impact;
  }
}

// wholesale_bag_direct.js - Static
frappe.pages["wholesale-bag-direct"].on_page_load = function (wrapper) {
  // -- Page Initialization --
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Wholesale Bag Direct Sale",
    single_column: true,
  });

  // -- Page Body Layout --
  $(page.body).html(`

      <!-- Status and Save Button -->
      <div class="wbd-meta-row">
        <span class="wbd-status-chip">Not Saved</span>
        <button class="btn btn-dark wbd-save-btn">Save</button>
      </div>

      <div class="wbd-main-container">

        <!-- ===== Form Controls Section ===== -->
        <div class="wbd-form-section">
          <!-- Row 1: Series, Date, Posting Time -->
          <div class="wbd-form-row">
            <div>
              <label>Series <span class="wbd-required">*</span></label>
              <select>
                <option>WBS-DDMMYY-</option>
              </select>
            </div>
            <div>
              <label>Date <span class="wbd-required">*</span></label>
              <input type="date" value="2025-11-12">
            </div>
            <div>
              <label>Posting Time <span class="wbd-required">*</span></label>
              <input type="time" value="14:04">
            </div>
          </div>
          <!-- Row 2: Customer Type, Customer, Payment Method -->
          <div class="wbd-form-row">
            <div>
              <label>Customer Type</label>
              <select>
                <option>Individual</option>
              </select>
            </div>
            <div>
              <label>Customer <span class="wbd-required">*</span></label>
              <input type="text" placeholder="Select or create customer">
            </div>
            <div>
              <label>Payment Method <span class="wbd-required">*</span></label>
              <select>
                <option>Cash</option>
              </select>
            </div>
          </div>
          <!-- Row 3: ID Number (full width) -->
          <div class="wbd-form-row">
            <div>
              <label>ID Number</label>
              <input type="text" placeholder="NRIC / Passport / Company Reg">
            </div>
			<div></div>
  			<div></div>
          </div>
        </div>

        <!-- ===== Bag Overview Section ===== -->
   <div class="wbd-bag-overview-block">
   	<div class="wbd-bag-overview-header">
   		<span class="wbd-collapsible-btn" id="toggleBagOverview">
   			<span class="wbd-collapsible-icon">&#9660;</span>
   			Bag Overview
   		</span>
   		<label class="wbd-showbags-label">
   			<input type="checkbox" checked /> Show all available bags
   		</label>
   	</div>
   	<div class="wbd-bag-cards-row" id="bagCardsRow">
   		<!-- Card 1 -->
   		<div class="wbd-bag-card">
   			<div class="wbd-bag-card-top">
   				<span class="wbd-bag-id">Bag-001</span>
   				<span class="wbd-bag-total">RM 45,230.00</span>
   			</div>
   			<div class="wbd-bag-card-details">
   				<div class="wbd-bag-purity-row">
   					<span class="wbd-bag-purity">999</span>
   					<span class="wbd-bag-weight">150.5g</span>
   					<span class="wbd-bag-rm">RM 285.50/g</span>
   				</div>
   				<div class="wbd-bag-purity-row">
   					<span class="wbd-bag-purity">916</span>
   					<span class="wbd-bag-weight">200.0g</span>
   					<span class="wbd-bag-rm">RM 245.20/g</span>
   				</div>
   			</div>
   		</div>
   		<!-- Card 2 -->
   		<div class="wbd-bag-card">
   			<div class="wbd-bag-card-top">
   				<span class="wbd-bag-id">Bag-003</span>
   				<span class="wbd-bag-total">RM 32,450.00</span>
   			</div>
   			<div class="wbd-bag-card-details">
   				<div class="wbd-bag-purity-row">
   					<span class="wbd-bag-purity">916</span>
   					<span class="wbd-bag-weight">125.8g</span>
   					<span class="wbd-bag-rm">RM 248.10/g</span>
   				</div>
   			</div>
   		</div>
   	</div>

	</div>
        <!-- ===== Items Table Section ===== -->
        <div class="wbd-table-block">
          <span class="wbd-table-title">Items</span>
          <table class="wbd-table">
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>No.</th>
                <th>Source Bag</th>
                <th>Purity</th>
                <th>Description</th>
                <th>Weight (g)</th>
                <th>AVCO (RM/g)</th>
                <th>Sell Rate (RM/g)</th>
                <th>Amount (MYR)</th>
                <th>Profit/g (RM/g)</th>
                <th>Total Profit (MYR)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="checkbox"></td>
                <td>1</td>
                <td><select><option>Select Bag...</option></select></td>
                <td><select><option>---</option></select></td>
                <td><input type="text" placeholder="Optional notes"></td>
                <td><input type="number" value="0.00"></td>
                <td><input type="number" value="0.00"></td>
                <td><input type="number" value="0.00"></td>
                <td><input type="number" value="0.00"></td>
                <td><input type="number" value="0.00"></td>
                <td><input type="number" value="0.00"></td>
                <td><button class="wbd-row-remove">&times;</button></td>
              </tr>
              <tr>
                <td><input type="checkbox" checked></td>
                <td>2</td>
                <td><select><option>Bag-001</option></select></td>
                <td><select><option>999 (150.5g)</option></select></td>
                <td><input type="text" value="Premium quality pieces"></td>
                <td><input type="number" value="50.00"></td>
                <td><input type="number" value="285.50"></td>
                <td><input type="number" value="295.00"></td>
                <td><input type="number" value="14,750.00"></td>
                <td class="wbd-row-green"><input type="number" value="9.50"></td>
                <td class="wbd-row-green"><input type="number" value="475.00"></td>
                <td><button class="wbd-row-remove">&times;</button></td>
              </tr>
            </tbody>
          </table>
          <button class="btn wbd-add-row-btn">+ Add Row</button>
        </div>

        <!-- ===== Document Totals Section ===== -->
        <div class="wbd-totals-block">
          <span class="wbd-totals-title">Document Totals</span>
          <div class="wbd-totals-card">
            <div class="wbd-totals-row"><span>Total Weight Sold (g)</span><span>50.00</span></div>
            <div class="wbd-totals-row"><span>Total AVCO Cost (MYR)</span><span>RM 14,275.00</span></div>
            <div class="wbd-totals-row wbd-totals-dark"><span>Total Selling Amount (MYR)</span><span>RM 14,750.00</span></div>
            <div class="wbd-totals-row"><span>Average Profit/g (RM/g)</span><span>9.50</span></div>
            <div class="wbd-totals-row wbd-totals-green"><span>Total Profit (MYR)</span><span>RM 475.00</span></div>
            <div class="wbd-totals-row"><span>Overall Profit Margin (%)</span><span>3.33%</span></div>
          </div>
        </div>
      </div>
    `);

  // ===== Bag Overview Expand/Collapse =====
  $(document).on("click", "#toggleBagOverview", function () {
    const $icon = $(this).find(".wbd-collapsible-icon");
    const $cards = $("#bagCardsRow");
    if ($cards.is(":visible")) {
      $cards.slideUp(190);
      $icon.css("transform", "rotate(-90deg)");
    } else {
      $cards.slideDown(190);
      $icon.css("transform", "rotate(0deg)");
    }
  });
};

// wholesale_bag_direct.js - Dynamic
frappe.pages["wholesale-bag-direct"].on_page_load = function (wrapper) {
  // -- Page Initialization --
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Wholesale Bag Direct Sale",
    single_column: true,
  });

  let bagOverviewData = [];

  // -- Page Body Layout --
  $(page.body).html(`
    <!-- Status and Save Button -->
    <div class="wbd-meta-row" style="display: flex; align-items: center; justify-content: space-between;">
    	<span class="wbd-status-chip">Not Saved</span>
    	<div>
    		<button class="wbd-save-btn">Save</button>
    		<button class="wbd-invoice-btn" style="margin-left: 10px;">Create Invoice</button>
    	</div>
    </div>

    <div class="wbd-main-container">
      <!-- ===== Form Controls Section ===== -->
      <div class="wbd-form-section">
        <!-- Row 1: Series, Date, Posting Time -->
        <div class="wbd-form-row">
          <div>
            <label>Series <span class="wbd-required">*</span></label>
            <select>
              <option>WBS-DDMMYY-</option>
            </select>
          </div>
          <div>
            <label>Date <span class="wbd-required">*</span></label>
            <input type="date" value="">
          </div>
          <div>
            <label>Posting Time <span class="wbd-required">*</span></label>
            <input type="time" value="">
          </div>
        </div>
        <!-- Row 2: Customer Type, Customer, Payment Method -->
        <div class="wbd-form-row">
          <div>
            <label>Customer Type</label>
            <select>
              <option>Individual</option>
            </select>
          </div>
          <div>
            <label>Customer <span class="wbd-required">*</span></label>
            <input type="text" id="customerInput" list="customerOptions" placeholder="Select or search customer">
            <datalist id="customerOptions"></datalist>
          </div>
          <div>
            <label>Payment Method <span class="wbd-required">*</span></label>
            <select>
              <option>Cash</option>
            </select>
          </div>
        </div>
        <!-- Row 3: ID Number (full width) -->
        <div class="wbd-form-row">
          <div>
            <label>ID Number</label>
            <input type="text" id="idNumberInput" placeholder="NRIC / Passport / Company Reg">
          </div>
          <div></div>
          <div></div>
        </div>
      </div>

      <!-- ===== Bag Overview Section ===== -->
      <div class="wbd-bag-overview-block">
        <div class="wbd-bag-overview-header">
          <span class="wbd-collapsible-btn" id="toggleBagOverview">
            <span class="wbd-collapsible-icon">&#9660;</span> Bag Overview
          </span>
          <label class="wbd-showbags-label">
            <input type="checkbox" checked /> Show all available bags
          </label>
        </div>
        <div class="wbd-bag-cards-row" id="bagCardsRow"></div>
      </div>

      <!-- ===== Items Table Section ===== -->
      <div class="wbd-table-block">
        <span class="wbd-table-title">Items</span>
        <table class="wbd-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>No.</th>
              <th>Source Bag</th>
              <th class="wbd-purity-col">Purity</th>
              <th>Description</th>
              <th>Weight (g)</th>
              <th>AVCO (RM/g)</th>
              <th>Sell Rate (RM/g)</th>
              <th>Amount (MYR)</th>
              <th>Profit/g (RM/g)</th>
              <th>Total Profit (MYR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="checkbox"></td>
              <td>1</td>
              <td><select class="wbd-src-bag">${getBagOptionsHtml()}</select></td>
              <td><select class="wbd-src-purity"><option value="">---</option></select></td>
              <td><input type="text" placeholder="Optional notes"></td>
              <td><input type="number" class="wbd-weight" min="0" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><button class="wbd-row-remove">&times;</button></td>
            </tr>
          </tbody>
        </table>
        <button class="btn wbd-add-row-btn">+ Add Row</button>
      </div>

      <!-- ===== Document Totals Section ===== -->
      <div class="wbd-totals-block">
        <span class="wbd-totals-title">Document Totals</span>
        <div class="wbd-totals-card">
          <div class="wbd-totals-row"><span>Total Weight Sold (g)</span><span>50.00</span></div>
          <div class="wbd-totals-row"><span>Total AVCO Cost (MYR)</span><span>RM 14,275.00</span></div>
          <div class="wbd-totals-row wbd-totals-dark"><span>Total Selling Amount (MYR)</span><span>RM 14,750.00</span></div>
          <div class="wbd-totals-row"><span>Average Profit/g (RM/g)</span><span>9.50</span></div>
          <div class="wbd-totals-row wbd-totals-green"><span>Total Profit (MYR)</span><span>RM 475.00</span></div>
          <div class="wbd-totals-row"><span>Overall Profit Margin (%)</span><span>3.33%</span></div>
        </div>
      </div>
    </div>`);

  // Set current date and time on page load
  const now = new Date();
  const padZero = (n) => n.toString().padStart(2, "0");

  const currentDate = `${now.getFullYear()}-${padZero(
    now.getMonth() + 1
  )}-${padZero(now.getDate())}`;
  const currentTime = `${padZero(now.getHours())}:${padZero(now.getMinutes())}`;

  // Set values in the date and time inputs
  $("input[type='date']").val(currentDate);
  $("input[type='time']").val(currentTime);

  // Function to build dynamic bag card HTML
  function renderBagCards(bags) {
    let html = "";
    bags.forEach((bag) => {
      let purityRows = bag.purities
        .map(
          (purity) => `
          <div class="wbd-bag-purity-row">
            <span class="wbd-bag-purity">${purity.purity}</span>
            <span class="wbd-bag-weight">${purity.weight}g</span>
            <span class="wbd-bag-rm">RM ${purity.rate}/g</span>
          </div>`
        )
        .join("");

      html += `
        <div class="wbd-bag-card">
          <div class="wbd-bag-card-top">
            <span class="wbd-bag-id">${bag.bag_id}</span>
            <span class="wbd-bag-total">RM ${bag.bag_total.toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}</span>
          </div>
          <div class="wbd-bag-card-details">${purityRows}</div>
        </div>`;
    });
    return html;
  }

  // Show loader in Bag Overview block
  $("#bagCardsRow").html(`
	<div class="loader-overlay">
	  <div class="loader"></div>
	  <p>Loading bags, please wait...</p>
	</div>
	`);

  // Fetch bag overview data from backend API and render cards & initialize table options
  frappe.call({
    method: "gold_app.api.sales.wholesale_bag_direct.get_all_bag_overview",
    callback: function (r) {
      if (r.message) {
        bagOverviewData = r.message;
        const bagCardsHtml = renderBagCards(bagOverviewData);
        $("#bagCardsRow").html(bagCardsHtml);
        renderItemsTableOptions();
        updateDocumentTotals();
      }
    },
  });

  async function fetchCustomerIDNumber(customerName) {
    try {
      const r = await frappe.call({
        method: "frappe.client.get_value",
        args: {
          doctype: "Customer",
          fieldname: ["id_number"],
          filters: { name: customerName },
        },
      });
      if (r.message && r.message.id_number) {
        document.getElementById("idNumberInput").value = r.message.id_number;
      } else {
        document.getElementById("idNumberInput").value = "";
      }
    } catch (err) {
      console.error("Failed to fetch ID number:", err);
    }
  }

  const customerInput = document.getElementById("customerInput");

  customerInput.addEventListener("input", async function () {
    let query = this.value.trim();
    if (query.length > 0) {
      try {
        const r = await frappe.call({
          method: "frappe.client.get_list",
          args: {
            doctype: "Customer",
            fields: ["name", "customer_name"],
            filters: [["customer_name", "like", "%" + query + "%"]],
            limit_page_length: 20,
          },
        });
        renderCustomerOptions(r.message || []);
      } catch (err) {
        console.error("Error searching customers:", err);
        renderCustomerOptions([]);
      }
    } else {
      renderCustomerOptions([]);
    }
  });

  customerInput.addEventListener("change", function () {
    const list = document.getElementById("customerOptions");
    let selectedName = this.value;
    let selectedId = null;
    for (let opt of list.options) {
      if (opt.value === selectedName) {
        selectedId = opt.getAttribute("data-id");
        break;
      }
    }
    if (selectedId) {
      fetchCustomerIDNumber(selectedId);
    }
  });

  function renderCustomerOptions(customers) {
    const list = document.getElementById("customerOptions");
    list.innerHTML = "";
    customers.forEach((c) => {
      const option = document.createElement("option");
      option.value = c.customer_name;
      option.setAttribute("data-id", c.name);
      list.appendChild(option);
    });
  }

  // Helper functions for dynamic bag and purity options in table rows
  function getBagOptionsHtml() {
    if (!bagOverviewData.length) return '<option value="">Loading...</option>';
    return (
      '<option value="">Select Bag...</option>' +
      bagOverviewData
        .map((bag) => `<option value="${bag.bag_id}">${bag.bag_id}</option>`)
        .join("")
    );
  }

  function getPurityOptionsHtml(selectedBagId) {
    const bag = bagOverviewData.find((b) => b.bag_id === selectedBagId);
    if (!bag) return '<option value="">---</option>';
    return (
      '<option value="">---</option>' +
      bag.purities
        .map(
          (p) =>
            `<option value="${p.purity}" data-weight="${p.weight}">${p.purity}</option>`
        )
        .join("")
    );
  }

  function buildTableRow(rowNum = 1) {
    return `<tr>
      <td><input type="checkbox"></td>
      <td>${rowNum}</td>
      <td><select class="wbd-src-bag">${getBagOptionsHtml()}</select></td>
      <td><select class="wbd-src-purity"><option value="">---</option></select></td>
      <td><input type="text" placeholder="Optional notes"></td>
      <td><input type="number" class="wbd-weight" min="0" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><button class="wbd-row-remove">&times;</button></td>
    </tr>`;
  }

  function renderItemsTableOptions() {
    const $rows = $(".wbd-table tbody tr");
    $rows.each(function () {
      const $tr = $(this);
      const $bagSelect = $tr.find("select.wbd-src-bag");
      const $puritySelect = $tr.find("select.wbd-src-purity");

      // Refresh Source Bag dropdown preserving selection if possible
      const selectedBagId = $bagSelect.val();
      $bagSelect.html(getBagOptionsHtml());
      if (selectedBagId) $bagSelect.val(selectedBagId);

      // Refresh Purity options based on selected bag
      const selectedBagForPurity = $bagSelect.val();
      const selectedPurity = $puritySelect.val();
      $puritySelect.html(getPurityOptionsHtml(selectedBagForPurity));
      if (selectedPurity) $puritySelect.val(selectedPurity);
    });
  }

  function updateDocumentTotals() {
    let totalWeight = 0;
    let totalAvcoCost = 0;
    let totalSelling = 0;
    let totalProfit = 0;
    let profitPerGramSum = 0;
    let rowCount = 0;

    $(".wbd-table tbody tr").each(function () {
      const $row = $(this);

      // Fetch cell values (all as numbers)
      const weight = parseFloat($row.find(".wbd-weight").val()) || 0;
      const avcoRate =
        parseFloat($row.find("input[type='number']").eq(1).val()) || 0;
      const sellRate =
        parseFloat($row.find("input[type='number']").eq(2).val()) || 0;
      const amount =
        parseFloat($row.find("input[type='number']").eq(3).val()) || 0; // Optional
      const profitPerGram =
        parseFloat($row.find("input[type='number']").eq(4).val()) || 0;
      const totalProfitRow =
        parseFloat($row.find("input[type='number']").eq(5).val()) || 0;

      totalWeight += weight;
      totalAvcoCost += avcoRate * weight;
      totalSelling += sellRate * weight;
      totalProfit += totalProfitRow; // Or recalculate if needed
      profitPerGramSum += profitPerGram;
      rowCount += 1;
    });

    // Average Profit/g
    let avgProfitPerGram = rowCount ? profitPerGramSum / rowCount : 0;

    // Overall Profit Margin (%)
    let profitMargin = totalSelling ? (totalProfit / totalSelling) * 100 : 0;

    // Update the Totals Section
    const $totals = $(".wbd-totals-card");
    $totals
      .find(".wbd-totals-row")
      .eq(0)
      .find("span")
      .eq(1)
      .text(totalWeight.toFixed(2));
    $totals
      .find(".wbd-totals-row")
      .eq(1)
      .find("span")
      .eq(1)
      .text(
        "RM " +
          totalAvcoCost.toLocaleString(undefined, { minimumFractionDigits: 2 })
      );
    $totals
      .find(".wbd-totals-row")
      .eq(2)
      .find("span")
      .eq(1)
      .text(
        "RM " +
          totalSelling.toLocaleString(undefined, { minimumFractionDigits: 2 })
      );
    $totals
      .find(".wbd-totals-row")
      .eq(3)
      .find("span")
      .eq(1)
      .text(avgProfitPerGram.toFixed(2));
    $totals
      .find(".wbd-totals-row")
      .eq(4)
      .find("span")
      .eq(1)
      .text(
        "RM " +
          totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })
      );
    $totals
      .find(".wbd-totals-row")
      .eq(5)
      .find("span")
      .eq(1)
      .text(profitMargin.toFixed(2) + "%");
  }

  // Events
  // When Bag changes, update purity options and reset weight input
  $(".wbd-table").on("change", "select.wbd-src-bag", function () {
    const $tr = $(this).closest("tr");
    const selectedBagId = $(this).val();
    $tr.find("select.wbd-src-purity").html(getPurityOptionsHtml(selectedBagId));
    $tr.find(".wbd-weight").val("0.00").attr("max", 0);
    updateDocumentTotals();
  });

  // When Purity changes, update max allowed weight, reset weight input, and set AVCO rate
  $(".wbd-table").on("change", "select.wbd-src-purity", function () {
    const $tr = $(this).closest("tr");
    const bagId = $tr.find("select.wbd-src-bag").val();
    const purityVal = $(this).val();
    const bag = bagOverviewData.find((b) => b.bag_id === bagId);
    const purityData = bag
      ? bag.purities.find((p) => p.purity === purityVal)
      : null;

    // Set max for weight
    $tr.find(".wbd-weight").attr("max", purityData ? purityData.weight : 0);
    $tr.find(".wbd-weight").val("0.00");

    // Set AVCO (RM/g) field — 7th input (index 6)
    $tr
      .find("input[type='number']")
      .eq(1)
      .val(purityData ? purityData.rate.toFixed(2) : "0.00");
    updateDocumentTotals();
  });

  // Validate weight input not to exceed max allowed
  $(".wbd-table").on("input", ".wbd-weight", function () {
    const maxWeight = Number($(this).attr("max")) || 0;
    let val = parseFloat($(this).val()) || 0;
    if (val > maxWeight) {
      $(this).val(maxWeight);
    }
    updateDocumentTotals();
  });

  // Listen for any change in any number field in items table rows
  $(".wbd-table").on("input", "input[type='number']", function () {
    updateDocumentTotals();
  });

  $(".wbd-table").on(
    "input",
    "input[type='number'], select.wbd-src-bag, select.wbd-src-purity",
    function () {
      $(".wbd-table tbody tr").each(function () {
        // Fetch fields for this row
        const $row = $(this);
        const weight = parseFloat($row.find(".wbd-weight").val()) || 0;
        const avcoRate =
          parseFloat($row.find("input[type='number']").eq(1).val()) || 0;
        const sellRate =
          parseFloat($row.find("input[type='number']").eq(2).val()) || 0;

        // Auto-calculate Amount (MYR)
        $row
          .find("input[type='number']")
          .eq(3)
          .val((weight * avcoRate).toFixed(2));

        // Auto-calculate Profit/g (RM/g)
        $row
          .find("input[type='number']")
          .eq(4)
          .val((sellRate - avcoRate).toFixed(2));

        // Auto-calculate Total Profit (MYR)
        $row
          .find("input[type='number']")
          .eq(5)
          .val(((sellRate - avcoRate) * weight).toFixed(2));
      });

      // Always update document totals after row calculation
      updateDocumentTotals();
    }
  );

  // Add Row button event
  $(".wbd-add-row-btn").on("click", function () {
    const $tbody = $(".wbd-table tbody");
    $tbody.append(buildTableRow($tbody.children().length + 1));
    renderItemsTableOptions();
    updateDocumentTotals();
  });

  // Remove row event
  $(".wbd-table").on("click", ".wbd-row-remove", function () {
    $(this).closest("tr").remove();
    // Re-number remaining rows
    $(".wbd-table tbody tr").each(function (index) {
      $(this)
        .find("td:nth-child(2)")
        .text(index + 1);
    });
    renderItemsTableOptions();
    updateDocumentTotals();
  });

  // Save Button Event
  $(".wbd-save-btn").on("click", function () {
    // 1. Compose the data object matching API schema
    const data = {};

    // -- Header fields --
    data.series = $("select:contains('WBS-DDMMYY-')").val() || "WBS-DDMMYY-";
    data.date = $("input[type='date']").val();
    data.posting_time = $("input[type='time']").val();
    data.customer_type = $(".wbd-form-row select").eq(1).val() || "Individual";
    data.customer = $("#customerInput").val();
    data.payment_method = $(".wbd-form-row select").eq(2).val() || "Cash";
    data.id_number = $("#idNumberInput").val();

    // -- Document Totals --
    const $totals = $(".wbd-totals-card .wbd-totals-row");
    data.total_weight_sold =
      parseFloat($totals.eq(0).find("span").eq(1).text()) || 0;
    data.total_avco_cost =
      parseFloat(
        ($totals.eq(1).find("span").eq(1).text() || "0").replace(/[^\d.]/g, "")
      ) || 0;
    data.total_selling_amount =
      parseFloat(
        ($totals.eq(2).find("span").eq(1).text() || "0").replace(/[^\d.]/g, "")
      ) || 0;
    data.average_profit_per_g =
      parseFloat($totals.eq(3).find("span").eq(1).text()) || 0;
    data.total_profit =
      parseFloat(
        ($totals.eq(4).find("span").eq(1).text() || "0").replace(/[^\d.]/g, "")
      ) || 0;
    data.overall_profit_margin = $totals.eq(5).find("span").eq(1).text();

    // -- Items Table --
    data.items = [];
    $(".wbd-table tbody tr").each(function () {
      const $tr = $(this);
      const row = {
        source_bag: $tr.find("select.wbd-src-bag").val() || "",
        purity: $tr.find("select.wbd-src-purity").val() || "",
        description: $tr.find("input[type='text']").eq(0).val() || "",
        weight: parseFloat($tr.find(".wbd-weight").val()) || 0,
        avco_rate:
          parseFloat($tr.find("input[type='number']").eq(1).val()) || 0,
        sell_rate:
          parseFloat($tr.find("input[type='number']").eq(2).val()) || 0,
        amount: parseFloat($tr.find("input[type='number']").eq(3).val()) || 0,
        profit_per_g:
          parseFloat($tr.find("input[type='number']").eq(4).val()) || 0,
        total_profit:
          parseFloat($tr.find("input[type='number']").eq(5).val()) || 0,
      };
      data.items.push(row);
    });

    // 2. Show loader or disable Save button for feedback
    $(".wbd-save-btn").prop("disabled", true).text("Saving...");

    // 3. Call API
    frappe.call({
      method:
        "gold_app.api.sales.wholesale_bag_direct.create_wholesale_bag_direct_sale",
      type: "POST",
      args: { data },
      callback: function (r) {
        // 4. On Success or Error
        const $chip = $(".wbd-status-chip");
        if (r.message && r.message.status === "success") {
          $chip
            .text("Saved")
            .removeClass() // removes any previous classes/styles
            .addClass("wbd-status-chip saved");
        } else {
          $chip
            .text("Not Saved")
            .removeClass("saved")
            .addClass("wbd-status-chip");
          frappe.msgprint({
            title: "Save Error",
            message:
              r.message && r.message.message
                ? r.message.message
                : "Unknown error.",
            indicator: "red",
          });
        }
        $(".wbd-save-btn").prop("disabled", false).text("Save");
      },
    });
  });

  // Sales Invoice Button Event
  $(".wbd-invoice-btn").on("click", function () {
    // Collect Sales Invoice item data as per mapping
    // Get customer ID (doc.name) based on selected customer_name in the input
    let selectedCustomerName = $("#customerInput").val();
    let selectedCustomerId = null;
    $("#customerOptions option").each(function () {
      if ($(this).val() === selectedCustomerName) {
        selectedCustomerId = $(this).attr("data-id");
        return false;
      }
    });
    if (!selectedCustomerId) {
      frappe.msgprint("Please select a valid customer from the suggestions.");
      return;
    }
    let customer = selectedCustomerId;

    let items_data = [];

    $(".wbd-table tbody tr").each(function () {
      const $tr = $(this);

      // Construct "item_code" as "Unsorted-{purity}"
      const purity = $tr.find("select.wbd-src-purity").val() || "";
      const item_code = purity ? `Unsorted-${purity}` : "";

      // Get Source Bag for warehouse
      const source_bag = $tr.find("select.wbd-src-bag").val() || "";

      // Get Weight (g) as qty and weight_per_unit
      const qty = parseFloat($tr.find(".wbd-weight").val()) || 0;

      // Get AVCO (RM/g) as rate
      const rate =
        parseFloat($tr.find("input[type='number']").eq(2).val()) || 0;

      items_data.push({
        item_code: item_code,
        qty: qty,
        weight_per_unit: qty,
        rate: rate,
        purity: purity,
        warehouse: source_bag,
      });
    });

    // Optional: validate data
    if (!customer || !items_data.length) {
      frappe.msgprint(
        "Customer and at least one item are required for Sales Invoice."
      );
      return;
    }

    // Disable button and show feedback
    $(".wbd-invoice-btn").prop("disabled", true).text("Creating...");

    frappe.call({
      method: "gold_app.api.sales.wholesale_bag_direct.create_sales_invoice",
      args: {
        customer: customer,
        items: JSON.stringify(items_data),
      },
      callback: function (r) {
        $(".wbd-invoice-btn").prop("disabled", false).text("Create Invoice");
        if (r.message && r.message.status === "success") {
          frappe.show_alert({
            message: "Sales Invoice Created: " + r.message.sales_invoice,
            indicator: "green",
          });
          setTimeout(function () {
            location.reload();
          }, 1500);
        } else {
          frappe.msgprint({
            message: "Failed to create Sales Invoice.",
            title: "Error",
            indicator: "red",
          });
        }
      },
    });
  });

  // Bag Overview Expand/Collapse
  $(document).on("click", "#toggleBagOverview", function () {
    const $icon = $(this).find(".wbd-collapsible-icon");
    const $cards = $("#bagCardsRow");
    if ($cards.is(":visible")) {
      $cards.slideUp(190);
      $icon.css("transform", "rotate(-90deg)");
    } else {
      $cards.slideDown(190);
      $icon.css("transform", "rotate(0deg)");
    }
  });
};
