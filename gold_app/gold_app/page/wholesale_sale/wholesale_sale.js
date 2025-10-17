frappe.pages["wholesale-sale"].on_page_load = function (wrapper) {
	new WholesaleSalePage(wrapper);
};

class WholesaleSalePage {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: "New Wholesale Sale",
			single_column: true,
		});

		this.current_step = 1;

		// Add parent class wrapper
		this.page.body.addClass("wholesale-sale-page");

		// Step titles mapping
		this.stepTitles = {
			1: "Step 1: Select wholesale bag to sell",
			2: "Step 2: Enter buyer and sale details",
			3: "Step 3: Receipt input and reconciliation",
		};

		// Append step label + step tracker + step container
		this.page.body.append(`
			<div class="step-header">
				<span class="back-icon hidden"><i class="fa fa-arrow-left"></i></span>
				<p class="step-label step-label-page">${this.stepTitles[this.current_step]}</p>
			</div>
			<div class="step-tracker">
				<div class="step step-1 active">1. Select Bag</div>
				<div class="step step-2">2. Buyer Details</div>
				<div class="step step-3">3. Receipt & Reconciliation</div>
			</div>
			<div class="step-container"></div>
		`);

		// Cache containers
		this.stepLabelEl = this.page.body.find(".step-label-page");
		this.container = this.page.body.find(".step-container");
		this.backIcon = this.page.body.find(".back-icon");
		this.backIcon.on("click", () => this.goBack());

		// Render first step
		this.renderStep(this.current_step);
	}

	renderStep(step_num, selectedBag = null) {
		// Update step label
		this.stepLabelEl.text(this.stepTitles[step_num]);

		// Show/hide back icon
		if (step_num === 1) this.backIcon.addClass("hidden");
		else this.backIcon.removeClass("hidden");

		// Clear step container
		this.container.empty();

		// Update step tracker
		this.page.body.find(".step-tracker .step").each((i, el) => {
			$(el).removeClass("active completed");
			if (i + 1 < step_num) $(el).addClass("completed");
			if (i + 1 === step_num) $(el).addClass("active");
		});

		// Render step content
		if (step_num === 1) {
			new Step1SelectBag(this.container, (bagName) => {
				this.selectedBag = bagName; // save selected bag
				this.goToStep(2, bagName); // pass to Step 2
			});
		} else if (step_num === 2) {
			new Step2BuyerDetails(
				this.container,
				selectedBag || this.selectedBag, // use dynamic bag
				(step3Data) => this.goToStep(3, step3Data),
				() => this.goToStep(1)
			);
		} else if (step_num === 3) {
			new Step3ReceiptAndReconciliation(this.container, this.step3Data, () =>
				this.goToStep(2)
			);
		}
	}

	goToStep(step_num, data = null) {
		this.current_step = step_num;

		if (step_num === 2 && data) {
			this.selectedBag = data; // save bag for Step 2
		}

		if (step_num === 3 && data) {
			this.step3Data = data; // save Step 3 data
		}

		this.renderStep(step_num, this.selectedBag);
	}

	goBack() {
		if (this.current_step > 1) {
			this.goToStep(this.current_step - 1);
		}
	}
}

