# render.py

def render_template(template, data):
    # This function will render a template with the provided data
    # For simplicity, we'll just return the template with placeholders replaced
    for key, value in data.items():
        template = template.replace(f"{{{key}}}", str(value))
    return template
