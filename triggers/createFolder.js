var hookID = "";
const eventIds = [];

const subscribeHook = async (z, bundle) => {
	const { v4: uuidv4 } = require("uuid");
	const eventIds = [];

	const fetchEvents = {
		url: `https://api.pixelbinz0.de/service/platform/notification/v1.0/events`,
		method: "GET",
	};

	try {
		let response = await z.request(fetchEvents);

		if (response.status === 200) {
			const temp = [...response.data];
			const obj = temp.find(
				(item) => item.name === "folder" && item.type === "create"
			);
			eventIds.push(obj._id);
		} else {
			throw new Error(`Failed to retrieve events. Status: ${response.status}`);
		}
	} catch (error) {
		z.console.log("Error fetching events: " + error.message);
		throw error;
	}

	const testWebHook = {
		url: `https://api.pixelbinz0.de/service/platform/notification/v1.0/webhook-configs/test`,
		method: "POST",
		body: {
			url: "https://www.example.com",
			secret: "",
		},
	};

	try {
		let testHookResponse = await z.request(testWebHook);
		if (testHookResponse.status === 200) {
			try {
				const webhookConfigResponse = await z.request({
					url: `https://api.pixelbinz0.de/service/platform/notification/v1.0/webhook-configs`,
					method: "POST",
					body: {
						events: [...eventIds],
						isActive: true,
						name: uuidv4(),
						secret: "",
						url: bundle.targetUrl,
					},
				});

				if (webhookConfigResponse.status === 200) {
					hookID = webhookConfigResponse.data.webhookConfigId;
					return webhookConfigResponse.data;
				} else {
					throw new Error(
						`Failed to create webhook configuration. Status: ${webhookConfigResponse.status}`
					);
				}
			} catch (error) {
				z.console.log("Error creating webhook configuration: " + error.message);
				throw error;
			}
		}
	} catch (error) {
		z.console.log("Error creating TEST WEBHOOK: " + error.message);
		throw new Error(
			`Failed to create a test webhook configuration. Status: ${error}`
		);
	}
};

const unsubscribeHook = (z, bundle) => {
	const options = {
		url: `https://api.pixelbinz0.de/service/platform/notification/v1.0/webhook-configs/${hookID}`,
		method: "DELETE",
	};
	return z
		.request(options)
		.then((response) => {
			if (response.status === 200) {
				return response.data;
			} else {
				throw new Error(`Failed to delete. Status: ${response.status}`);
			}
		})
		.catch((error) => {
			z.console.log("Failed to delete" + error.message);
			return [];
		});
};

const deletePropertiesRecursive = (obj) => {
	for (const key in obj) {
		if (typeof obj[key] === "object" && obj[key] !== null) {
			deletePropertiesRecursive(obj[key]);
		} else {
			if (key === "querystring" || key === "s3Bucket" || key === "s3Key") {
				delete obj[key];
			}
		}
	}
};

const performList = async (z, bundle) => {
	const { PixelbinConfig, PixelbinClient } = require("@pixelbin/admin");

	body = {
		event: {
			name: "folder",
			type: "create",
			traceId: "c19e8dfc-b94f-4bc5-8725-d3ff361035e1",
		},
		payload: {
			_id: "d8e0394c-2235-422e-bd48-53c4cf1ae0f4",
			name: "folderName",
			path: "",
			isActive: true,
		},
	};

	let defaultPixelBinClient = new PixelbinClient(
		new PixelbinConfig({
			domain: `https://api.pixelbinz0.de`,
			apiSecret: bundle.authData.apiKey,
		})
	);

	try {
		let temp = await defaultPixelBinClient.assets.listFilesPaginator({
			onlyFolders: true,
			path: "",
		});
		const { items, page } = await temp.next();

		if (items.length) {
			body.payload.id = items[0]._id;
			body.payload.name = items[0].name;
		}
	} catch (error) {
		throw error;
	}

	return [{ ...body }];
};

const getDataFromWebHook = async (z, bundle) => {
	const { PixelbinConfig, PixelbinClient } = require("@pixelbin/admin");

	let defaultPixelBinClient = new PixelbinClient(
		new PixelbinConfig({
			domain: `${process.env.BASE_URL}`,
			apiSecret: bundle.authData.apiKey,
		})
	);

	const orgDetails =
		await defaultPixelBinClient.organization.getAppOrgDetails();
	[bundle.cleanedRequest].forEach((obj) => {
		delete obj.querystring;
		delete obj.s3Bucket;
		delete obj.s3Key;
		deletePropertiesRecursive(obj);
	});
	return [{ ...bundle.cleanedRequest }];
};

module.exports = {
	key: "createFolder",

	noun: "CreateFolder",
	display: {
		label: "Create Folder",
		description: "Triggers when a new folder is created in PixelBin.io.",
	},

	operation: {
		inputFields: [],
		type: "hook",
		performSubscribe: subscribeHook,
		performUnsubscribe: unsubscribeHook,
		perform: getDataFromWebHook,
		performList: performList,
	},
};
