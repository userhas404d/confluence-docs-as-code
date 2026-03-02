# API Contracts: Confluence v2 REST API

This directory contains the API contract schemas for the Confluence v2 REST API endpoints used by the pull tool. These contracts define the request/response format for each SDK method.

## Endpoints

| Contract File                                        | SDK Method                      | Confluence v2 Endpoint                        |
| ---------------------------------------------------- | ------------------------------- | --------------------------------------------- |
| [get-page-body.json](get-page-body.json)             | `getPageBody(pageId)`           | `GET /wiki/api/v2/pages/{id}`                 |
| [get-page-children.json](get-page-children.json)     | `getPageChildren(pageId)`       | `GET /wiki/api/v2/pages/{id}/direct-children` |
| [get-attachments.json](get-attachments.json)         | `getAttachments(pageId)`        | `GET /wiki/api/v2/pages/{id}/attachments`     |
| [download-attachment.json](download-attachment.json) | `downloadAttachment(url, dest)` | `GET {base}{downloadLink}`                    |
