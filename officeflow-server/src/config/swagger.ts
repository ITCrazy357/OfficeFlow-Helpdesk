import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "OfficeFlow Helpdesk API",
      version: "1.0.0",
      description: "REST API documentation for OfficeFlow Helpdesk backend.",
    },
    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiError: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Unauthorized",
            },
            errors: {
              type: "object",
              nullable: true,
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              example: "System Admin",
            },
            email: {
              type: "string",
              example: "admin@officeflow.com",
            },
            role: {
              type: "string",
              enum: ["ADMIN", "MANAGER", "IT_STAFF", "EMPLOYEE"],
              example: "ADMIN",
            },
            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },
        Department: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              example: "IT",
            },
          },
        },
        Ticket: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            title: {
              type: "string",
              example: "Cannot connect to VPN",
            },
            description: {
              type: "string",
              example: "I cannot connect to company VPN from my laptop.",
            },
            status: {
              type: "string",
              enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"],
              example: "OPEN",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              example: "HIGH",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
    },
  },
  apis: ["src/modules/**/*.ts"],
});
