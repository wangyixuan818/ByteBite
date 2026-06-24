// Codex initializer preparation: temporary UI vocabulary, not database IDs.
// TODO(backend): replace with GET /fridge-models data so model definitions have one source of truth.
export const FRIDGE_MODEL_OPTIONS = [
    { key: 'two-door', label: 'Two-door fridge', sections: ['upper', 'lower'] },
    { key: 'three-layer', label: 'Three-layer fridge', sections: ['upper', 'middle', 'lower'] },
];

// TODO(product): confirm whether pantry is a separate unit or another model section.
export const PANTRY_LAYER_OPTIONS = [2, 3];
