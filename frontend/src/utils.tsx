import { API_BASE_URL } from "../config";

export const getAvailableCategories = async () =>{
    const data = await fetch(`${API_BASE_URL}/categories`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (!data.ok){
        throw new Error(`Error fetching categories: ${data.statusText}`);
    }
    const categories = await data.json();
    const availableCategories = categories.map((category: { name: string }) => category.name);
    return availableCategories;
    
}