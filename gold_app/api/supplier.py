import frappe

def autoname(doc, method):
    # Ensure id_number is generated before assigning name
    if not doc.id_number:
        from gold_app.api.api import generate_id_number
        doc.id_number = generate_id_number()

    # Set the document name = id_number
    doc.name = doc.id_number


def set_supplier_group_before_save(doc, method):
    """
    Automatically set supplier_group = supplier_type
    before saving Supplier, if not already set.
    """
    if doc.supplier_type and not doc.supplier_group:
        doc.supplier_group = doc.supplier_type


def create_supplier_bank_account(doc, method):
    if not doc.bank_name or not doc.bank_account_number:
        return

    # Determine the company
    if hasattr(doc, "companies") and doc.companies:
        company = doc.companies[0].company
    else:
        company = frappe.defaults.get_user_default("Company")

    if not company:
        frappe.log_error(f"Supplier {doc.name} has no company set. Bank Account not created.", "Bank Account Creation Failed")
        return

    # Check if Bank Account already exists
    existing_account = frappe.get_all("Bank Account",
        filters={
            "party_type": "Supplier",
            "party": doc.name,
            "company": company
        },
        limit=1
    )
    if existing_account:
        return

    # Ensure the Bank exists
    bank_doc = frappe.get_all("Bank", filters={"bank_name": doc.bank_name}, limit=1)
    if bank_doc:
        bank_link = bank_doc[0].name
    else:
        bank = frappe.get_doc({
            "doctype": "Bank",
            "bank_name": doc.bank_name
        })
        bank.insert(ignore_permissions=True)
        frappe.db.commit()
        bank_link = bank.name

    # Create Bank Account
    bank_account = frappe.get_doc({
        "doctype": "Bank Account",
        "account_name": f"{doc.supplier_name} - {doc.bank_name}",
        "bank": bank_link,
        "bank_account_no": doc.bank_account_number,
        "party_type": "Supplier",
        "party": doc.name,
        "company": company
    })

    bank_account.insert(ignore_permissions=True)
    frappe.db.commit()
