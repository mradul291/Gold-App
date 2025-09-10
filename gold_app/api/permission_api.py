import frappe

# Condition to add documents restrictions to only Assigned Staff User or System Manager
def permission_query_item_pickup(user):
    if not user:
        user = frappe.session.user

    roles = frappe.get_roles(user)

    if "System Manager" in roles or user == "Administrator":
        return ""

    return f"""(`tabItem Pickup`.`assigned_to` = '{user}')"""

def has_permission_item_pickup(doc, user):
    roles = frappe.get_roles(user)

    if "System Manager" in roles or user == "Administrator":
        return True

    # Only allow if assigned_to matches
    return doc.assigned_to == user
