export const evaluateWithCouncil: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    individualResponses: any[];
    synthesis: object;
    executionLogs: any[];
}>, unknown>;
export const generatePixelBotPrompt: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    instructions: string;
}>, unknown>;
export const createUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    uid: string;
    message: string;
}>, unknown>;
export const updateUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
}>, unknown>;
export const resetPassword: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
}>, unknown>;
export const deleteUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
}>, unknown>;
export const seedWidgets: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
    activeWidgets: string[];
    categories: string[];
}>, unknown>;
export const updateStudentProfile: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
    success?: undefined;
    profile?: undefined;
} | {
    success: boolean;
    profile: any;
    message?: undefined;
}>, unknown>;
