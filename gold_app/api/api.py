import frappe

# Condition to Add Filter on Allocated To field in Item Pickup to ony get Role = Staff Users in field
@frappe.whitelist()
def get_staff_users(doctype, txt, searchfield, start, page_len, filters):
    return frappe.db.sql("""
        SELECT u.name, CONCAT(u.first_name, ' ', IFNULL(u.last_name, ''))
        FROM `tabUser` u
        INNER JOIN `tabHas Role` r ON u.name = r.parent
        WHERE r.role = 'Staff'
          AND u.enabled = 1
          AND (u.{key} LIKE %(txt)s 
               OR u.first_name LIKE %(txt)s 
               OR u.last_name LIKE %(txt)s)
        ORDER BY u.first_name
        LIMIT %(start)s, %(page_len)s
    """.format(key=searchfield), {
        "txt": "%" + txt + "%",
        "start": start,
        "page_len": page_len
    })

# Condition to add documents restrictions to only Assigned Staff User or System Manager
def user_specific_item_pickup(user):
    if not user:
        user = frappe.session.user

    roles = frappe.get_roles(user)

    if "System Manager" in roles or user == "Administrator":
        return ""

    return f"""(`tabItem Pickup`.`assigned_to` = '{user}')"""

# Create Customer on Supplier Creation
def sync_customer_with_supplier(doc, method):
    """Create/Update Customer when Supplier is created/updated"""
    if frappe.flags.in_auto_creation:
        return
    frappe.flags.in_auto_creation = True

    # Create if not exists
    customer = frappe.db.exists("Customer", {"customer_name": doc.supplier_name})
    if not customer:
        customer = frappe.new_doc("Customer")
        customer.customer_name = doc.supplier_name
        customer.customer_type = getattr(doc, "supplier_type", None)
        customer.customer_group = getattr(doc, "supplier_group", None)
        customer.bank_name = getattr(doc, "bank_name", None)
        customer.bank_account_number = getattr(doc, "bank_account_number", None)
        customer.save(ignore_permissions=True)
    else:
        customer = frappe.get_doc("Customer", customer)

    # --- Sync Address & Contact ---
    if doc.supplier_primary_address:
        link_dynamic("Address", doc.supplier_primary_address, "Customer", customer.name)
        if not customer.customer_primary_address:
            customer.customer_primary_address = doc.supplier_primary_address

    if doc.supplier_primary_contact:
        link_dynamic("Contact", doc.supplier_primary_contact, "Customer", customer.name)
        if not customer.customer_primary_contact:
            customer.customer_primary_contact = doc.supplier_primary_contact

        customer.save(ignore_permissions=True)

    frappe.flags.in_auto_creation = False

# Create Supplier on Customer Creation
def sync_supplier_with_customer(doc, method):
    """Create/Update Supplier when Customer is created/updated"""
    if frappe.flags.in_auto_creation:
        return
    frappe.flags.in_auto_creation = True

    supplier = frappe.db.exists("Supplier", {"supplier_name": doc.customer_name})
    if not supplier:
        supplier = frappe.new_doc("Supplier")
        supplier.supplier_name = doc.customer_name
        supplier.supplier_type = getattr(doc, "customer_type", None)
        supplier.supplier_group = getattr(doc, "customer_group", None)
        supplier.bank_name = getattr(doc, "bank_name", None)
        supplier.bank_account_number = getattr(doc, "bank_account_number", None)
        supplier.save(ignore_permissions=True)
    else:
        supplier = frappe.get_doc("Supplier", supplier)

    # --- Sync Address & Contact ---
    if doc.customer_primary_address:
        link_dynamic("Address", doc.customer_primary_address, "Supplier", supplier.name)
        if not supplier.supplier_primary_address:
            supplier.supplier_primary_address = doc.customer_primary_address

    if doc.customer_primary_contact:
        link_dynamic("Contact", doc.customer_primary_contact, "Supplier", supplier.name)
        if not supplier.supplier_primary_contact:
            supplier.supplier_primary_contact = doc.customer_primary_contact

        supplier.save(ignore_permissions=True)

    frappe.flags.in_auto_creation = False

# Link the Address and Contact for Supplier and Customer Vise Versa
def link_dynamic(doctype, docname, link_doctype, link_name):
    """Ensure Dynamic Link table contains both Customer and Supplier references"""
    linked_doc = frappe.get_doc(doctype, docname)

    exists = any(
        dl.link_doctype == link_doctype and dl.link_name == link_name
        for dl in linked_doc.links
    )

    if not exists:
        linked_doc.append("links", {
            "link_doctype": link_doctype,
            "link_name": link_name,
            "link_title": link_name,
        })
        linked_doc.save(ignore_permissions=True)

