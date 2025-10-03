import frappe

def autoname(doc, method):
    # Ensure id_number is generated before assigning name
    if not doc.id_number:
        from gold_app.api.api import generate_id_number
        doc.id_number = generate_id_number()

    # Set the document name = id_number
    doc.name = doc.id_number
