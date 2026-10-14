"""The editor assistant: operation checks (no model) and the route with a fake model."""

from api.assistant import EditPlan, EditRequest, _checked

TEMPLATES = ["midnight", "bold", "minimal"]


def _req(kind="carousel", slides=3, max_slides=20, **extra):
    project = {
        "title": "T",
        "kind": kind,
        "template": "midnight",
        "accent": "#FF5A3C",
        "hashtags": ["pricing"],
        "caption": "Old caption",
        "slides": [{"headline": f"Headline {i}", "body": f"Body {i}"} for i in range(1, slides + 1)],
    }
    return EditRequest(message="x", project=project, templates=TEMPLATES, max_slides=max_slides, **extra)


def _plan(*ops):
    return EditPlan(reply="ok", operations=list(ops))


def test_out_of_range_and_unchanged_edits_are_dropped():
    ops, _ = _checked(
        _plan(
            {"op": "update_slide", "slide": 9, "headline": "nope"},
            {"op": "update_slide", "slide": 1, "headline": "Headline 1", "body": "Body 1"},
            {"op": "update_slide", "slide": 2, "headline": "New two"},
        ),
        _req(),
    )
    assert ops == [{"op": "update_slide", "slide": 2, "headline": "New two"}]


def test_single_slide_formats_cannot_add_or_delete():
    plan = _plan({"op": "add_slide", "slide": 1, "headline": "x"}, {"op": "delete_slide", "slide": 1})
    assert _checked(plan, _req(kind="poster", slides=1, max_slides=1))[0] == []


def test_slide_limit_and_never_delete_everything():
    ops, _ = _checked(_plan(*[{"op": "add_slide", "slide": 3, "headline": f"n{i}"} for i in range(5)]), _req(max_slides=5))
    assert len(ops) == 2
    ops, _ = _checked(_plan({"op": "delete_slide", "slide": 1}, {"op": "delete_slide", "slide": 2}), _req(slides=2))
    assert len(ops) == 1


def test_design_must_be_a_known_template_and_a_new_hex_color():
    plan = _plan({"op": "update_design", "template": "neon", "accent": "blue"}, {"op": "update_design", "template": "midnight", "accent": "#ff5a3c"})
    assert _checked(plan, _req())[0] == []
    ops, _ = _checked(_plan({"op": "update_design", "template": "bold", "accent": "#1e40af"}), _req())
    assert ops == [{"op": "update_design", "template": "bold", "accent": "#1E40AF"}]


def test_hashtags_are_added_not_replaced():
    ops, _ = _checked(_plan({"op": "update_post", "add_hashtags": ["Pricing", "growth"], "remove_hashtags": ["nothere"]}), _req())
    assert ops == [{"op": "update_post", "add_hashtags": ["growth"]}]


def test_diagram_fields_on_a_text_update_become_a_diagram_change():
    plan = _plan({"op": "update_slide", "slide": 2, "visual_type": "timeline", "items": [{"label": "A"}, {"label": "B"}, {"label": "C"}]})
    assert _checked(plan, _req())[0] == []  # carousels have no diagrams
    ops, _ = _checked(plan, _req(kind="deck"))
    assert ops[0]["op"] == "set_visual" and ops[0]["visual_type"] == "timeline" and len(ops[0]["items"]) == 3


def test_house_style_is_applied():
    ops, _ = _checked(_plan({"op": "update_slide", "slide": 1, "headline": "Fast — and cheap 🚀"}), _req())
    assert ops[0]["headline"] == "Fast, and cheap"
