import axios from "axios";
import { getAuthHeader } from "../context/AuthenticationContext";

// API boundary for the recipe feature. Keeping these calls here means the UI
// will not need to change when the recipe data source is replaced in MS3.
export const getRecipeList = () => {
    const headers = getAuthHeader();
    // Codex minimal UI pass: unwrap Axios so pages receive the documented array.
    return axios.get("/api/v1/recipes", { headers }).then(response => response.data);
};

export const getRecipe = (id) => {
    const headers = getAuthHeader();
    // Codex minimal UI pass: accept either common detail response wrapper.
    return axios.get(`/api/v1/recipes/${id}`, { headers }).then(response => response.data.recipe ?? response.data.result);
};

// TODO (MS3): If recipes move to an external provider, normalize its response
// into the ByteBite <recipe> object before returning data to the components.
