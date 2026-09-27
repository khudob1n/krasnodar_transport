"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = deleteFile;
exports.uploadFile = uploadFile;
const tslib_1 = require("tslib");
const constants_1 = require("./constants");
function deleteFile(id, jwt) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            yield fetch(`${constants_1.STRAPI_URL}/api/upload/files/${id}`, {
                headers: Object.assign({}, (jwt ? { Authorization: `Bearer ${jwt}` } : {})),
                method: 'DELETE',
            });
        }
        catch (e) {
            console.log(e);
        }
    });
}
function uploadFile(data, jwt) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield fetch(`${constants_1.STRAPI_URL}/api/upload`, {
                headers: Object.assign({}, (jwt ? { Authorization: `Bearer ${jwt}` } : {})),
                method: 'POST',
                body: data,
            });
            const body = (yield resp.json());
            if (body.error) {
                throw new Error(JSON.stringify(body.error));
            }
            if (resp.status !== 200) {
                throw new Error(resp.statusText);
            }
            return body;
        }
        catch (e) {
            console.log(e);
        }
    });
}
//# sourceMappingURL=upload.js.map