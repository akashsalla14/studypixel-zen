declare const ACTIVE_PROFILE: string;
export { ACTIVE_PROFILE as PROFILE_NAME };
export declare let PROFILE_DESCRIPTION: any;
export declare let INFERENCE_URL: string;
export declare let ROUTER_MODEL: any;
export declare let EVALUATOR_A_MODEL: any;
export declare let EVALUATOR_B_MODEL: any;
export declare let EVALUATOR_C_MODEL: any;
export declare let INSTRUCTOR_MODEL: any;
export declare function getApiKey(): string;
export declare let SEQUENTIAL_EVALUATORS: any;
export declare let EVALUATOR_MAX_TOKENS: any;
export declare let INSTRUCTOR_MAX_TOKENS: number;
export declare let ROUTER_MAX_TOKENS: number;
export declare namespace GENERATION_PARAMS {
    namespace router {
        let temperature: number;
        let top_p: number;
    }
    namespace evaluators {
        let temperature_1: number;
        export { temperature_1 as temperature };
        let top_p_1: number;
        export { top_p_1 as top_p };
    }
    namespace instructor {
        let temperature_2: number;
        export { temperature_2 as temperature };
        let top_p_2: number;
        export { top_p_2 as top_p };
    }
}
export declare let AVAILABLE_PROFILES: {
    name: string;
    description: string;
}[];
