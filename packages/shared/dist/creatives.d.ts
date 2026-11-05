import { z } from "zod";
import { WorkspaceRoleSchema } from "./workspace.js";
export declare const CREATIVE_BUCKET = "workspace-creative-assets";
export declare const CREATIVE_ASSET_MAX_BYTES: number;
export declare const CREATIVE_ASSET_MIME_TYPES: readonly ["image/png", "image/jpeg", "image/webp"];
export declare const CREATIVE_FONT_FAMILIES: readonly ["Inter", "Arial", "Georgia", "DM Sans", "Space Grotesk", "Playfair Display", "Roboto", "Lato"];
export declare const CreativeBackgroundSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"solid">;
    color: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"gradient">;
    from: z.ZodString;
    to: z.ZodString;
    angle: z.ZodNumber;
}, z.core.$strip>], "kind">;
export declare const CreativeTextElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    rotation: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodBoolean>;
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
    fontFamily: z.ZodDefault<z.ZodEnum<{
        Inter: "Inter";
        Arial: "Arial";
        Georgia: "Georgia";
        "DM Sans": "DM Sans";
        "Space Grotesk": "Space Grotesk";
        "Playfair Display": "Playfair Display";
        Roboto: "Roboto";
        Lato: "Lato";
    }>>;
    fontSize: z.ZodDefault<z.ZodNumber>;
    fontWeight: z.ZodDefault<z.ZodEnum<{
        400: "400";
        500: "500";
        600: "600";
        700: "700";
        800: "800";
    }>>;
    letterSpacing: z.ZodDefault<z.ZodNumber>;
    color: z.ZodString;
    align: z.ZodDefault<z.ZodEnum<{
        left: "left";
        center: "center";
        right: "right";
    }>>;
}, z.core.$strip>;
export declare const CreativeShapeElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    rotation: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodBoolean>;
    type: z.ZodLiteral<"shape">;
    shape: z.ZodEnum<{
        rectangle: "rectangle";
        circle: "circle";
    }>;
    fill: z.ZodString;
    borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    borderWidth: z.ZodDefault<z.ZodNumber>;
    radius: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const CreativeImageElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    rotation: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodBoolean>;
    type: z.ZodLiteral<"image">;
    assetId: z.ZodString;
    fit: z.ZodDefault<z.ZodEnum<{
        cover: "cover";
        contain: "contain";
    }>>;
}, z.core.$strip>;
export declare const CreativeElementSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    rotation: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodBoolean>;
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
    fontFamily: z.ZodDefault<z.ZodEnum<{
        Inter: "Inter";
        Arial: "Arial";
        Georgia: "Georgia";
        "DM Sans": "DM Sans";
        "Space Grotesk": "Space Grotesk";
        "Playfair Display": "Playfair Display";
        Roboto: "Roboto";
        Lato: "Lato";
    }>>;
    fontSize: z.ZodDefault<z.ZodNumber>;
    fontWeight: z.ZodDefault<z.ZodEnum<{
        400: "400";
        500: "500";
        600: "600";
        700: "700";
        800: "800";
    }>>;
    letterSpacing: z.ZodDefault<z.ZodNumber>;
    color: z.ZodString;
    align: z.ZodDefault<z.ZodEnum<{
        left: "left";
        center: "center";
        right: "right";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    rotation: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodBoolean>;
    type: z.ZodLiteral<"shape">;
    shape: z.ZodEnum<{
        rectangle: "rectangle";
        circle: "circle";
    }>;
    fill: z.ZodString;
    borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    borderWidth: z.ZodDefault<z.ZodNumber>;
    radius: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    rotation: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodBoolean>;
    type: z.ZodLiteral<"image">;
    assetId: z.ZodString;
    fit: z.ZodDefault<z.ZodEnum<{
        cover: "cover";
        contain: "contain";
    }>>;
}, z.core.$strip>], "type">;
export declare const CreativeDocumentSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    width: z.ZodNumber;
    height: z.ZodNumber;
    background: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"solid">;
        color: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"gradient">;
        from: z.ZodString;
        to: z.ZodString;
        angle: z.ZodNumber;
    }, z.core.$strip>], "kind">;
    elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        rotation: z.ZodDefault<z.ZodNumber>;
        opacity: z.ZodDefault<z.ZodNumber>;
        locked: z.ZodDefault<z.ZodBoolean>;
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
        fontFamily: z.ZodDefault<z.ZodEnum<{
            Inter: "Inter";
            Arial: "Arial";
            Georgia: "Georgia";
            "DM Sans": "DM Sans";
            "Space Grotesk": "Space Grotesk";
            "Playfair Display": "Playfair Display";
            Roboto: "Roboto";
            Lato: "Lato";
        }>>;
        fontSize: z.ZodDefault<z.ZodNumber>;
        fontWeight: z.ZodDefault<z.ZodEnum<{
            400: "400";
            500: "500";
            600: "600";
            700: "700";
            800: "800";
        }>>;
        letterSpacing: z.ZodDefault<z.ZodNumber>;
        color: z.ZodString;
        align: z.ZodDefault<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        rotation: z.ZodDefault<z.ZodNumber>;
        opacity: z.ZodDefault<z.ZodNumber>;
        locked: z.ZodDefault<z.ZodBoolean>;
        type: z.ZodLiteral<"shape">;
        shape: z.ZodEnum<{
            rectangle: "rectangle";
            circle: "circle";
        }>;
        fill: z.ZodString;
        borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        borderWidth: z.ZodDefault<z.ZodNumber>;
        radius: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        rotation: z.ZodDefault<z.ZodNumber>;
        opacity: z.ZodDefault<z.ZodNumber>;
        locked: z.ZodDefault<z.ZodBoolean>;
        type: z.ZodLiteral<"image">;
        assetId: z.ZodString;
        fit: z.ZodDefault<z.ZodEnum<{
            cover: "cover";
            contain: "contain";
        }>>;
    }, z.core.$strip>], "type">>;
    generation: z.ZodOptional<z.ZodObject<{
        mode: z.ZodLiteral<"offline">;
        label: z.ZodLiteral<"Offline Creative Variations">;
        seed: z.ZodNumber;
        style: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CreativeToneSchema: z.ZodEnum<{
    clear: "clear";
    warm: "warm";
    confident: "confident";
    playful: "playful";
    premium: "premium";
    expert: "expert";
}>;
export declare const BrandKitInputSchema: z.ZodObject<{
    displayName: z.ZodString;
    tagline: z.ZodDefault<z.ZodString>;
    mainMessage: z.ZodDefault<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
    primaryColor: z.ZodString;
    secondaryColor: z.ZodString;
    accentColors: z.ZodDefault<z.ZodArray<z.ZodString>>;
    backgroundPreferences: z.ZodDefault<z.ZodArray<z.ZodString>>;
    savedPalettes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        colors: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    headingFont: z.ZodEnum<{
        Inter: "Inter";
        Arial: "Arial";
        Georgia: "Georgia";
        "DM Sans": "DM Sans";
        "Space Grotesk": "Space Grotesk";
        "Playfair Display": "Playfair Display";
        Roboto: "Roboto";
        Lato: "Lato";
    }>;
    bodyFont: z.ZodEnum<{
        Inter: "Inter";
        Arial: "Arial";
        Georgia: "Georgia";
        "DM Sans": "DM Sans";
        "Space Grotesk": "Space Grotesk";
        "Playfair Display": "Playfair Display";
        Roboto: "Roboto";
        Lato: "Lato";
    }>;
    tone: z.ZodEnum<{
        clear: "clear";
        warm: "warm";
        confident: "confident";
        playful: "playful";
        premium: "premium";
        expert: "expert";
    }>;
    ctaStyle: z.ZodEnum<{
        custom: "custom";
        warm: "warm";
        confident: "confident";
        direct: "direct";
        minimal: "minimal";
    }>;
    website: z.ZodNullable<z.ZodString>;
    socialHandles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    industry: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    logoAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    alternateLogoAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const BrandKitSchema: z.ZodObject<{
    displayName: z.ZodString;
    tagline: z.ZodDefault<z.ZodString>;
    mainMessage: z.ZodDefault<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
    primaryColor: z.ZodString;
    secondaryColor: z.ZodString;
    accentColors: z.ZodDefault<z.ZodArray<z.ZodString>>;
    backgroundPreferences: z.ZodDefault<z.ZodArray<z.ZodString>>;
    savedPalettes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        colors: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    headingFont: z.ZodEnum<{
        Inter: "Inter";
        Arial: "Arial";
        Georgia: "Georgia";
        "DM Sans": "DM Sans";
        "Space Grotesk": "Space Grotesk";
        "Playfair Display": "Playfair Display";
        Roboto: "Roboto";
        Lato: "Lato";
    }>;
    bodyFont: z.ZodEnum<{
        Inter: "Inter";
        Arial: "Arial";
        Georgia: "Georgia";
        "DM Sans": "DM Sans";
        "Space Grotesk": "Space Grotesk";
        "Playfair Display": "Playfair Display";
        Roboto: "Roboto";
        Lato: "Lato";
    }>;
    tone: z.ZodEnum<{
        clear: "clear";
        warm: "warm";
        confident: "confident";
        playful: "playful";
        premium: "premium";
        expert: "expert";
    }>;
    ctaStyle: z.ZodEnum<{
        custom: "custom";
        warm: "warm";
        confident: "confident";
        direct: "direct";
        minimal: "minimal";
    }>;
    website: z.ZodNullable<z.ZodString>;
    socialHandles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    industry: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    logoAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    alternateLogoAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    workspaceId: z.ZodString;
    revision: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare const CreativeAssetSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    type: z.ZodEnum<{
        image: "image";
        logo: "logo";
    }>;
    originalFilename: z.ZodString;
    mimeType: z.ZodEnum<{
        "image/png": "image/png";
        "image/jpeg": "image/jpeg";
        "image/webp": "image/webp";
    }>;
    sizeBytes: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    uploaderId: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    archivedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    signedUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const CreativeAssetListQuerySchema: z.ZodObject<{
    search: z.ZodDefault<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<{
        image: "image";
        logo: "logo";
    }>>;
    archived: z.ZodDefault<z.ZodPreprocess<z.ZodBoolean, unknown>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const CreativeProjectStatusSchema: z.ZodEnum<{
    draft: "draft";
    needs_review: "needs_review";
    changes_requested: "changes_requested";
    archived: "archived";
    approved: "approved";
}>;
export declare const CreativePlatformSchema: z.ZodNullable<z.ZodEnum<{
    google_ads: "google_ads";
    meta_ads: "meta_ads";
}>>;
export declare const CreativeProjectSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    document: z.ZodObject<{
        version: z.ZodLiteral<1>;
        width: z.ZodNumber;
        height: z.ZodNumber;
        background: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"solid">;
            color: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"gradient">;
            from: z.ZodString;
            to: z.ZodString;
            angle: z.ZodNumber;
        }, z.core.$strip>], "kind">;
        elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
            fontFamily: z.ZodDefault<z.ZodEnum<{
                Inter: "Inter";
                Arial: "Arial";
                Georgia: "Georgia";
                "DM Sans": "DM Sans";
                "Space Grotesk": "Space Grotesk";
                "Playfair Display": "Playfair Display";
                Roboto: "Roboto";
                Lato: "Lato";
            }>>;
            fontSize: z.ZodDefault<z.ZodNumber>;
            fontWeight: z.ZodDefault<z.ZodEnum<{
                400: "400";
                500: "500";
                600: "600";
                700: "700";
                800: "800";
            }>>;
            letterSpacing: z.ZodDefault<z.ZodNumber>;
            color: z.ZodString;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"shape">;
            shape: z.ZodEnum<{
                rectangle: "rectangle";
                circle: "circle";
            }>;
            fill: z.ZodString;
            borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            borderWidth: z.ZodDefault<z.ZodNumber>;
            radius: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"image">;
            assetId: z.ZodString;
            fit: z.ZodDefault<z.ZodEnum<{
                cover: "cover";
                contain: "contain";
            }>>;
        }, z.core.$strip>], "type">>;
        generation: z.ZodOptional<z.ZodObject<{
            mode: z.ZodLiteral<"offline">;
            label: z.ZodLiteral<"Offline Creative Variations">;
            seed: z.ZodNumber;
            style: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        draft: "draft";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        archived: "archived";
        approved: "approved";
    }>;
    revision: z.ZodNumber;
    approvedRevision: z.ZodNullable<z.ZodNumber>;
    industry: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    platform: z.ZodNullable<z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>>;
    templateKey: z.ZodNullable<z.ZodString>;
    campaignIds: z.ZodArray<z.ZodString>;
    createdBy: z.ZodString;
    updatedAt: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const CreativeProjectWriteSchema: z.ZodObject<{
    name: z.ZodString;
    document: z.ZodObject<{
        version: z.ZodLiteral<1>;
        width: z.ZodNumber;
        height: z.ZodNumber;
        background: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"solid">;
            color: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"gradient">;
            from: z.ZodString;
            to: z.ZodString;
            angle: z.ZodNumber;
        }, z.core.$strip>], "kind">;
        elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
            fontFamily: z.ZodDefault<z.ZodEnum<{
                Inter: "Inter";
                Arial: "Arial";
                Georgia: "Georgia";
                "DM Sans": "DM Sans";
                "Space Grotesk": "Space Grotesk";
                "Playfair Display": "Playfair Display";
                Roboto: "Roboto";
                Lato: "Lato";
            }>>;
            fontSize: z.ZodDefault<z.ZodNumber>;
            fontWeight: z.ZodDefault<z.ZodEnum<{
                400: "400";
                500: "500";
                600: "600";
                700: "700";
                800: "800";
            }>>;
            letterSpacing: z.ZodDefault<z.ZodNumber>;
            color: z.ZodString;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"shape">;
            shape: z.ZodEnum<{
                rectangle: "rectangle";
                circle: "circle";
            }>;
            fill: z.ZodString;
            borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            borderWidth: z.ZodDefault<z.ZodNumber>;
            radius: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"image">;
            assetId: z.ZodString;
            fit: z.ZodDefault<z.ZodEnum<{
                cover: "cover";
                contain: "contain";
            }>>;
        }, z.core.$strip>], "type">>;
        generation: z.ZodOptional<z.ZodObject<{
            mode: z.ZodLiteral<"offline">;
            label: z.ZodLiteral<"Offline Creative Variations">;
            seed: z.ZodNumber;
            style: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    industry: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    platform: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>>>;
    templateKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const CreativeListQuerySchema: z.ZodObject<{
    search: z.ZodDefault<z.ZodString>;
    campaignId: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        archived: "archived";
        approved: "approved";
    }>>;
    aspect: z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        square: "square";
        portrait: "portrait";
        vertical: "vertical";
        landscape: "landscape";
    }>>;
    sort: z.ZodDefault<z.ZodEnum<{
        name: "name";
        updated: "updated";
        created: "created";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const CreativeVariationInputSchema: z.ZodObject<{
    idempotencyKey: z.ZodOptional<z.ZodString>;
    seed: z.ZodDefault<z.ZodNumber>;
    aspectRatio: z.ZodDefault<z.ZodEnum<{
        square: "square";
        portrait: "portrait";
        vertical: "vertical";
        landscape: "landscape";
    }>>;
    imageAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    hook: z.ZodDefault<z.ZodString>;
    industry: z.ZodOptional<z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>>;
    businessName: z.ZodDefault<z.ZodString>;
    productService: z.ZodDefault<z.ZodString>;
    offer: z.ZodDefault<z.ZodString>;
    cta: z.ZodDefault<z.ZodString>;
    mainMessage: z.ZodDefault<z.ZodString>;
    objective: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const CreativeVariationSchema: z.ZodObject<{
    name: z.ZodString;
    style: z.ZodString;
    seed: z.ZodNumber;
    document: z.ZodObject<{
        version: z.ZodLiteral<1>;
        width: z.ZodNumber;
        height: z.ZodNumber;
        background: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"solid">;
            color: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"gradient">;
            from: z.ZodString;
            to: z.ZodString;
            angle: z.ZodNumber;
        }, z.core.$strip>], "kind">;
        elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
            fontFamily: z.ZodDefault<z.ZodEnum<{
                Inter: "Inter";
                Arial: "Arial";
                Georgia: "Georgia";
                "DM Sans": "DM Sans";
                "Space Grotesk": "Space Grotesk";
                "Playfair Display": "Playfair Display";
                Roboto: "Roboto";
                Lato: "Lato";
            }>>;
            fontSize: z.ZodDefault<z.ZodNumber>;
            fontWeight: z.ZodDefault<z.ZodEnum<{
                400: "400";
                500: "500";
                600: "600";
                700: "700";
                800: "800";
            }>>;
            letterSpacing: z.ZodDefault<z.ZodNumber>;
            color: z.ZodString;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"shape">;
            shape: z.ZodEnum<{
                rectangle: "rectangle";
                circle: "circle";
            }>;
            fill: z.ZodString;
            borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            borderWidth: z.ZodDefault<z.ZodNumber>;
            radius: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"image">;
            assetId: z.ZodString;
            fit: z.ZodDefault<z.ZodEnum<{
                cover: "cover";
                contain: "contain";
            }>>;
        }, z.core.$strip>], "type">>;
        generation: z.ZodOptional<z.ZodObject<{
            mode: z.ZodLiteral<"offline">;
            label: z.ZodLiteral<"Offline Creative Variations">;
            seed: z.ZodNumber;
            style: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    label: z.ZodLiteral<"Offline Creative Variations">;
}, z.core.$strip>;
export declare const CreativeTemplateSchema: z.ZodObject<{
    key: z.ZodString;
    name: z.ZodString;
    category: z.ZodString;
    description: z.ZodString;
    industries: z.ZodArray<z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>>;
    document: z.ZodObject<{
        version: z.ZodLiteral<1>;
        width: z.ZodNumber;
        height: z.ZodNumber;
        background: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"solid">;
            color: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"gradient">;
            from: z.ZodString;
            to: z.ZodString;
            angle: z.ZodNumber;
        }, z.core.$strip>], "kind">;
        elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
            fontFamily: z.ZodDefault<z.ZodEnum<{
                Inter: "Inter";
                Arial: "Arial";
                Georgia: "Georgia";
                "DM Sans": "DM Sans";
                "Space Grotesk": "Space Grotesk";
                "Playfair Display": "Playfair Display";
                Roboto: "Roboto";
                Lato: "Lato";
            }>>;
            fontSize: z.ZodDefault<z.ZodNumber>;
            fontWeight: z.ZodDefault<z.ZodEnum<{
                400: "400";
                500: "500";
                600: "600";
                700: "700";
                800: "800";
            }>>;
            letterSpacing: z.ZodDefault<z.ZodNumber>;
            color: z.ZodString;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"shape">;
            shape: z.ZodEnum<{
                rectangle: "rectangle";
                circle: "circle";
            }>;
            fill: z.ZodString;
            borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            borderWidth: z.ZodDefault<z.ZodNumber>;
            radius: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"image">;
            assetId: z.ZodString;
            fit: z.ZodDefault<z.ZodEnum<{
                cover: "cover";
                contain: "contain";
            }>>;
        }, z.core.$strip>], "type">>;
        generation: z.ZodOptional<z.ZodObject<{
            mode: z.ZodLiteral<"offline">;
            label: z.ZodLiteral<"Offline Creative Variations">;
            seed: z.ZodNumber;
            style: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CreativeReviewInputSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        changes_requested: "changes_requested";
        approved: "approved";
        submitted: "submitted";
        reopened: "reopened";
    }>;
    comments: z.ZodDefault<z.ZodString>;
    expectedRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const CreativeReviewSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    creativeId: z.ZodString;
    revision: z.ZodNumber;
    decision: z.ZodEnum<{
        changes_requested: "changes_requested";
        approved: "approved";
        submitted: "submitted";
        reopened: "reopened";
    }>;
    reviewerId: z.ZodString;
    comments: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const CreativeRevisionSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    creativeId: z.ZodString;
    revision: z.ZodNumber;
    name: z.ZodString;
    document: z.ZodObject<{
        version: z.ZodLiteral<1>;
        width: z.ZodNumber;
        height: z.ZodNumber;
        background: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"solid">;
            color: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"gradient">;
            from: z.ZodString;
            to: z.ZodString;
            angle: z.ZodNumber;
        }, z.core.$strip>], "kind">;
        elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
            fontFamily: z.ZodDefault<z.ZodEnum<{
                Inter: "Inter";
                Arial: "Arial";
                Georgia: "Georgia";
                "DM Sans": "DM Sans";
                "Space Grotesk": "Space Grotesk";
                "Playfair Display": "Playfair Display";
                Roboto: "Roboto";
                Lato: "Lato";
            }>>;
            fontSize: z.ZodDefault<z.ZodNumber>;
            fontWeight: z.ZodDefault<z.ZodEnum<{
                400: "400";
                500: "500";
                600: "600";
                700: "700";
                800: "800";
            }>>;
            letterSpacing: z.ZodDefault<z.ZodNumber>;
            color: z.ZodString;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"shape">;
            shape: z.ZodEnum<{
                rectangle: "rectangle";
                circle: "circle";
            }>;
            fill: z.ZodString;
            borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            borderWidth: z.ZodDefault<z.ZodNumber>;
            radius: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            rotation: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            locked: z.ZodDefault<z.ZodBoolean>;
            type: z.ZodLiteral<"image">;
            assetId: z.ZodString;
            fit: z.ZodDefault<z.ZodEnum<{
                cover: "cover";
                contain: "contain";
            }>>;
        }, z.core.$strip>], "type">>;
        generation: z.ZodOptional<z.ZodObject<{
            mode: z.ZodLiteral<"offline">;
            label: z.ZodLiteral<"Offline Creative Variations">;
            seed: z.ZodNumber;
            style: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        draft: "draft";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        archived: "archived";
        approved: "approved";
    }>;
    authorId: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const BrandKitResponseSchema: z.ZodObject<{
    brandKit: z.ZodObject<{
        displayName: z.ZodString;
        tagline: z.ZodDefault<z.ZodString>;
        mainMessage: z.ZodDefault<z.ZodString>;
        description: z.ZodDefault<z.ZodString>;
        primaryColor: z.ZodString;
        secondaryColor: z.ZodString;
        accentColors: z.ZodDefault<z.ZodArray<z.ZodString>>;
        backgroundPreferences: z.ZodDefault<z.ZodArray<z.ZodString>>;
        savedPalettes: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            colors: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>>;
        headingFont: z.ZodEnum<{
            Inter: "Inter";
            Arial: "Arial";
            Georgia: "Georgia";
            "DM Sans": "DM Sans";
            "Space Grotesk": "Space Grotesk";
            "Playfair Display": "Playfair Display";
            Roboto: "Roboto";
            Lato: "Lato";
        }>;
        bodyFont: z.ZodEnum<{
            Inter: "Inter";
            Arial: "Arial";
            Georgia: "Georgia";
            "DM Sans": "DM Sans";
            "Space Grotesk": "Space Grotesk";
            "Playfair Display": "Playfair Display";
            Roboto: "Roboto";
            Lato: "Lato";
        }>;
        tone: z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>;
        ctaStyle: z.ZodEnum<{
            custom: "custom";
            warm: "warm";
            confident: "confident";
            direct: "direct";
            minimal: "minimal";
        }>;
        website: z.ZodNullable<z.ZodString>;
        socialHandles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        industry: z.ZodEnum<{
            real_estate: "real_estate";
            ecommerce_retail: "ecommerce_retail";
            healthcare_clinics: "healthcare_clinics";
            education_coaching: "education_coaching";
            gyms_fitness: "gyms_fitness";
            restaurants_cafes: "restaurants_cafes";
            hotels_hospitality: "hotels_hospitality";
            travel_tourism: "travel_tourism";
            automobile_dealerships: "automobile_dealerships";
            salons_beauty: "salons_beauty";
            professional_services: "professional_services";
            marketing_agencies: "marketing_agencies";
            home_services: "home_services";
            finance_insurance: "finance_insurance";
            events_entertainment: "events_entertainment";
            other: "other";
        }>;
        industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        logoAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        alternateLogoAssetId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceId: z.ZodString;
        revision: z.ZodNumber;
        updatedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strip>;
export declare const CreativeAssetResponseSchema: z.ZodObject<{
    asset: z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        type: z.ZodEnum<{
            image: "image";
            logo: "logo";
        }>;
        originalFilename: z.ZodString;
        mimeType: z.ZodEnum<{
            "image/png": "image/png";
            "image/jpeg": "image/jpeg";
            "image/webp": "image/webp";
        }>;
        sizeBytes: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        uploaderId: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        archivedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        signedUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CreativeAssetsResponseSchema: z.ZodObject<{
    assets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        type: z.ZodEnum<{
            image: "image";
            logo: "logo";
        }>;
        originalFilename: z.ZodString;
        mimeType: z.ZodEnum<{
            "image/png": "image/png";
            "image/jpeg": "image/jpeg";
            "image/webp": "image/webp";
        }>;
        sizeBytes: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        uploaderId: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        archivedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        signedUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
export declare const CreativeProjectResponseSchema: z.ZodObject<{
    project: z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        document: z.ZodObject<{
            version: z.ZodLiteral<1>;
            width: z.ZodNumber;
            height: z.ZodNumber;
            background: z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"solid">;
                color: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"gradient">;
                from: z.ZodString;
                to: z.ZodString;
                angle: z.ZodNumber;
            }, z.core.$strip>], "kind">;
            elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"text">;
                text: z.ZodString;
                fontFamily: z.ZodDefault<z.ZodEnum<{
                    Inter: "Inter";
                    Arial: "Arial";
                    Georgia: "Georgia";
                    "DM Sans": "DM Sans";
                    "Space Grotesk": "Space Grotesk";
                    "Playfair Display": "Playfair Display";
                    Roboto: "Roboto";
                    Lato: "Lato";
                }>>;
                fontSize: z.ZodDefault<z.ZodNumber>;
                fontWeight: z.ZodDefault<z.ZodEnum<{
                    400: "400";
                    500: "500";
                    600: "600";
                    700: "700";
                    800: "800";
                }>>;
                letterSpacing: z.ZodDefault<z.ZodNumber>;
                color: z.ZodString;
                align: z.ZodDefault<z.ZodEnum<{
                    left: "left";
                    center: "center";
                    right: "right";
                }>>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"shape">;
                shape: z.ZodEnum<{
                    rectangle: "rectangle";
                    circle: "circle";
                }>;
                fill: z.ZodString;
                borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                borderWidth: z.ZodDefault<z.ZodNumber>;
                radius: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"image">;
                assetId: z.ZodString;
                fit: z.ZodDefault<z.ZodEnum<{
                    cover: "cover";
                    contain: "contain";
                }>>;
            }, z.core.$strip>], "type">>;
            generation: z.ZodOptional<z.ZodObject<{
                mode: z.ZodLiteral<"offline">;
                label: z.ZodLiteral<"Offline Creative Variations">;
                seed: z.ZodNumber;
                style: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            draft: "draft";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            archived: "archived";
            approved: "approved";
        }>;
        revision: z.ZodNumber;
        approvedRevision: z.ZodNullable<z.ZodNumber>;
        industry: z.ZodEnum<{
            real_estate: "real_estate";
            ecommerce_retail: "ecommerce_retail";
            healthcare_clinics: "healthcare_clinics";
            education_coaching: "education_coaching";
            gyms_fitness: "gyms_fitness";
            restaurants_cafes: "restaurants_cafes";
            hotels_hospitality: "hotels_hospitality";
            travel_tourism: "travel_tourism";
            automobile_dealerships: "automobile_dealerships";
            salons_beauty: "salons_beauty";
            professional_services: "professional_services";
            marketing_agencies: "marketing_agencies";
            home_services: "home_services";
            finance_insurance: "finance_insurance";
            events_entertainment: "events_entertainment";
            other: "other";
        }>;
        platform: z.ZodNullable<z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>>;
        templateKey: z.ZodNullable<z.ZodString>;
        campaignIds: z.ZodArray<z.ZodString>;
        createdBy: z.ZodString;
        updatedAt: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CreativeProjectsResponseSchema: z.ZodObject<{
    projects: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        document: z.ZodObject<{
            version: z.ZodLiteral<1>;
            width: z.ZodNumber;
            height: z.ZodNumber;
            background: z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"solid">;
                color: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"gradient">;
                from: z.ZodString;
                to: z.ZodString;
                angle: z.ZodNumber;
            }, z.core.$strip>], "kind">;
            elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"text">;
                text: z.ZodString;
                fontFamily: z.ZodDefault<z.ZodEnum<{
                    Inter: "Inter";
                    Arial: "Arial";
                    Georgia: "Georgia";
                    "DM Sans": "DM Sans";
                    "Space Grotesk": "Space Grotesk";
                    "Playfair Display": "Playfair Display";
                    Roboto: "Roboto";
                    Lato: "Lato";
                }>>;
                fontSize: z.ZodDefault<z.ZodNumber>;
                fontWeight: z.ZodDefault<z.ZodEnum<{
                    400: "400";
                    500: "500";
                    600: "600";
                    700: "700";
                    800: "800";
                }>>;
                letterSpacing: z.ZodDefault<z.ZodNumber>;
                color: z.ZodString;
                align: z.ZodDefault<z.ZodEnum<{
                    left: "left";
                    center: "center";
                    right: "right";
                }>>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"shape">;
                shape: z.ZodEnum<{
                    rectangle: "rectangle";
                    circle: "circle";
                }>;
                fill: z.ZodString;
                borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                borderWidth: z.ZodDefault<z.ZodNumber>;
                radius: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"image">;
                assetId: z.ZodString;
                fit: z.ZodDefault<z.ZodEnum<{
                    cover: "cover";
                    contain: "contain";
                }>>;
            }, z.core.$strip>], "type">>;
            generation: z.ZodOptional<z.ZodObject<{
                mode: z.ZodLiteral<"offline">;
                label: z.ZodLiteral<"Offline Creative Variations">;
                seed: z.ZodNumber;
                style: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            draft: "draft";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            archived: "archived";
            approved: "approved";
        }>;
        revision: z.ZodNumber;
        approvedRevision: z.ZodNullable<z.ZodNumber>;
        industry: z.ZodEnum<{
            real_estate: "real_estate";
            ecommerce_retail: "ecommerce_retail";
            healthcare_clinics: "healthcare_clinics";
            education_coaching: "education_coaching";
            gyms_fitness: "gyms_fitness";
            restaurants_cafes: "restaurants_cafes";
            hotels_hospitality: "hotels_hospitality";
            travel_tourism: "travel_tourism";
            automobile_dealerships: "automobile_dealerships";
            salons_beauty: "salons_beauty";
            professional_services: "professional_services";
            marketing_agencies: "marketing_agencies";
            home_services: "home_services";
            finance_insurance: "finance_insurance";
            events_entertainment: "events_entertainment";
            other: "other";
        }>;
        platform: z.ZodNullable<z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>>;
        templateKey: z.ZodNullable<z.ZodString>;
        campaignIds: z.ZodArray<z.ZodString>;
        createdBy: z.ZodString;
        updatedAt: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    total: z.ZodNumber;
}, z.core.$strip>;
export declare const CreativeTemplatesResponseSchema: z.ZodObject<{
    templates: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        name: z.ZodString;
        category: z.ZodString;
        description: z.ZodString;
        industries: z.ZodArray<z.ZodEnum<{
            real_estate: "real_estate";
            ecommerce_retail: "ecommerce_retail";
            healthcare_clinics: "healthcare_clinics";
            education_coaching: "education_coaching";
            gyms_fitness: "gyms_fitness";
            restaurants_cafes: "restaurants_cafes";
            hotels_hospitality: "hotels_hospitality";
            travel_tourism: "travel_tourism";
            automobile_dealerships: "automobile_dealerships";
            salons_beauty: "salons_beauty";
            professional_services: "professional_services";
            marketing_agencies: "marketing_agencies";
            home_services: "home_services";
            finance_insurance: "finance_insurance";
            events_entertainment: "events_entertainment";
            other: "other";
        }>>;
        document: z.ZodObject<{
            version: z.ZodLiteral<1>;
            width: z.ZodNumber;
            height: z.ZodNumber;
            background: z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"solid">;
                color: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"gradient">;
                from: z.ZodString;
                to: z.ZodString;
                angle: z.ZodNumber;
            }, z.core.$strip>], "kind">;
            elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"text">;
                text: z.ZodString;
                fontFamily: z.ZodDefault<z.ZodEnum<{
                    Inter: "Inter";
                    Arial: "Arial";
                    Georgia: "Georgia";
                    "DM Sans": "DM Sans";
                    "Space Grotesk": "Space Grotesk";
                    "Playfair Display": "Playfair Display";
                    Roboto: "Roboto";
                    Lato: "Lato";
                }>>;
                fontSize: z.ZodDefault<z.ZodNumber>;
                fontWeight: z.ZodDefault<z.ZodEnum<{
                    400: "400";
                    500: "500";
                    600: "600";
                    700: "700";
                    800: "800";
                }>>;
                letterSpacing: z.ZodDefault<z.ZodNumber>;
                color: z.ZodString;
                align: z.ZodDefault<z.ZodEnum<{
                    left: "left";
                    center: "center";
                    right: "right";
                }>>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"shape">;
                shape: z.ZodEnum<{
                    rectangle: "rectangle";
                    circle: "circle";
                }>;
                fill: z.ZodString;
                borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                borderWidth: z.ZodDefault<z.ZodNumber>;
                radius: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"image">;
                assetId: z.ZodString;
                fit: z.ZodDefault<z.ZodEnum<{
                    cover: "cover";
                    contain: "contain";
                }>>;
            }, z.core.$strip>], "type">>;
            generation: z.ZodOptional<z.ZodObject<{
                mode: z.ZodLiteral<"offline">;
                label: z.ZodLiteral<"Offline Creative Variations">;
                seed: z.ZodNumber;
                style: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        placeholder: z.ZodBoolean;
    }, z.core.$strip>>;
    industries: z.ZodArray<z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>>;
}, z.core.$strip>;
export declare const CreativeVariationsResponseSchema: z.ZodObject<{
    mode: z.ZodLiteral<"offline">;
    label: z.ZodLiteral<"Offline Creative Variations">;
    variations: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        style: z.ZodString;
        seed: z.ZodNumber;
        document: z.ZodObject<{
            version: z.ZodLiteral<1>;
            width: z.ZodNumber;
            height: z.ZodNumber;
            background: z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"solid">;
                color: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"gradient">;
                from: z.ZodString;
                to: z.ZodString;
                angle: z.ZodNumber;
            }, z.core.$strip>], "kind">;
            elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"text">;
                text: z.ZodString;
                fontFamily: z.ZodDefault<z.ZodEnum<{
                    Inter: "Inter";
                    Arial: "Arial";
                    Georgia: "Georgia";
                    "DM Sans": "DM Sans";
                    "Space Grotesk": "Space Grotesk";
                    "Playfair Display": "Playfair Display";
                    Roboto: "Roboto";
                    Lato: "Lato";
                }>>;
                fontSize: z.ZodDefault<z.ZodNumber>;
                fontWeight: z.ZodDefault<z.ZodEnum<{
                    400: "400";
                    500: "500";
                    600: "600";
                    700: "700";
                    800: "800";
                }>>;
                letterSpacing: z.ZodDefault<z.ZodNumber>;
                color: z.ZodString;
                align: z.ZodDefault<z.ZodEnum<{
                    left: "left";
                    center: "center";
                    right: "right";
                }>>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"shape">;
                shape: z.ZodEnum<{
                    rectangle: "rectangle";
                    circle: "circle";
                }>;
                fill: z.ZodString;
                borderColor: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                borderWidth: z.ZodDefault<z.ZodNumber>;
                radius: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                id: z.ZodString;
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
                rotation: z.ZodDefault<z.ZodNumber>;
                opacity: z.ZodDefault<z.ZodNumber>;
                locked: z.ZodDefault<z.ZodBoolean>;
                type: z.ZodLiteral<"image">;
                assetId: z.ZodString;
                fit: z.ZodDefault<z.ZodEnum<{
                    cover: "cover";
                    contain: "contain";
                }>>;
            }, z.core.$strip>], "type">>;
            generation: z.ZodOptional<z.ZodObject<{
                mode: z.ZodLiteral<"offline">;
                label: z.ZodLiteral<"Offline Creative Variations">;
                seed: z.ZodNumber;
                style: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        label: z.ZodLiteral<"Offline Creative Variations">;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreativeDocument = z.infer<typeof CreativeDocumentSchema>;
export type CreativeElement = z.infer<typeof CreativeElementSchema>;
export type CreativeTextElement = z.infer<typeof CreativeTextElementSchema>;
export type CreativeShapeElement = z.infer<typeof CreativeShapeElementSchema>;
export type CreativeImageElement = z.infer<typeof CreativeImageElementSchema>;
export type BrandKit = z.infer<typeof BrandKitSchema>;
export type BrandKitInput = z.infer<typeof BrandKitInputSchema>;
export type CreativeAsset = z.infer<typeof CreativeAssetSchema>;
export type CreativeProject = z.infer<typeof CreativeProjectSchema>;
export type CreativeProjectWrite = z.infer<typeof CreativeProjectWriteSchema>;
export type CreativeProjectStatus = z.infer<typeof CreativeProjectStatusSchema>;
export type CreativePlatform = z.infer<typeof CreativeProjectSchema>["platform"];
export type CreativeRole = z.infer<typeof WorkspaceRoleSchema>;
//# sourceMappingURL=creatives.d.ts.map