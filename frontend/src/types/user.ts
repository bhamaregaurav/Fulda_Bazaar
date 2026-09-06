export default interface UserInterface {
    id ?: string;
    user_id?: number;  // Add user_id property
    firstName : string;
    lastName : string;
    email : string;
    password : string;
    role?: 'user' | 'admin';
    trust_score?: number;
    successful_transactions?: number;
    listings_count?: number;
}


export interface UserInterfaceListing {
    user_id: number;
    first_name : string;
    last_name : string;
    email : string;
}

export interface UserSigninInterface {
    email: string;
    password: string;
}