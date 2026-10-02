/**
 * Every Clio resource we pull for a matter. Field sets are ordered richest-first;
 * the client falls back down the list if Clio rejects a field.
 * Nothing here is specific to any one matter.
 */
export type ResourceDef = {
  name: string;
  path: string;
  params: Record<string, string>;
  fieldSets: string[];
};

export const MATTER_FIELD_SETS = [
  "id,etag,display_number,description,status,open_date,close_date,pending_date,created_at,updated_at," +
    "practice_area{id,name},client{id,name,type},responsible_attorney{id,name},originating_attorney{id,name}," +
    "custom_field_values{id,field_name,field_type,value}",
  "id,etag,display_number,description,status,open_date,close_date,created_at,updated_at," +
    "client{id,name,type},custom_field_values{id,value}",
  "id,display_number,description,status,open_date,client{id,name}",
];

export const CONTACT_FIELD_SETS = [
  "id,etag,name,type,title,prefix,first_name,last_name,date_of_birth,created_at,updated_at," +
    "email_addresses{name,address,default_email},phone_numbers{name,number,default_number}," +
    "addresses{name,street,city,province,postal_code,country},custom_field_values{id,field_name,value}",
  "id,name,type,created_at,updated_at,email_addresses{address},phone_numbers{number}",
  "id,name,type",
];

export const RESOURCES: ResourceDef[] = [
  {
    name: "notes",
    path: "notes.json",
    params: { type: "Matter" },
    fieldSets: [
      "id,etag,subject,detail,date,created_at,updated_at,author{id,name}",
      "id,subject,detail,date,created_at,updated_at",
    ],
  },
  {
    name: "communications",
    path: "communications.json",
    params: {},
    fieldSets: [
      "id,etag,subject,body,date,type,created_at,updated_at,senders{id,name,type},receivers{id,name,type}",
      "id,subject,body,date,type,created_at,updated_at",
    ],
  },
  {
    name: "tasks",
    path: "tasks.json",
    params: {},
    fieldSets: [
      "id,etag,name,description,status,priority,due_at,completed_at,created_at,updated_at,assignee{id,name,type}",
      "id,name,description,status,due_at,completed_at,created_at,updated_at",
    ],
  },
  {
    name: "calendar_entries",
    path: "calendar_entries.json",
    params: {},
    fieldSets: [
      "id,etag,summary,description,location,start_at,end_at,all_day,created_at,updated_at",
      "id,summary,description,start_at,end_at,created_at,updated_at",
    ],
  },
  {
    name: "documents",
    path: "documents.json",
    params: {},
    fieldSets: [
      "id,etag,name,content_type,size,created_at,updated_at,parent{id,name},latest_document_version{id,size,content_type}",
      "id,name,content_type,created_at,updated_at,latest_document_version{id}",
      "id,name,created_at,updated_at",
    ],
  },
  {
    name: "expenses",
    path: "activities.json",
    params: { type: "ExpenseEntry" },
    fieldSets: [
      "id,etag,type,date,quantity,price,total,note,created_at,updated_at,expense_category{id,name}",
      "id,type,date,total,note,created_at,updated_at",
    ],
  },
  {
    name: "relationships",
    path: "relationships.json",
    params: {},
    fieldSets: [
      "id,etag,description,created_at,updated_at,contact{id,name,type}",
      "id,description,contact{id,name}",
    ],
  },
];
