import fs from 'fs';
import yaml from 'js-yaml';


export const HOST = 'http://localhost:8080';

export const testRpcResponse = async function (res, expected) {
    if (!res.ok) throw new Error(res.statusText);

    const json = await res.json();

    if (json.error) throw new Error(json.error.message);
    if (!json.result) throw new Error("Malformed RPC response");

    // TODO: Test the responses
    testSameTypes(json, expected);
};

export const testHttpResponse = async function (res, expected) {
    if (!res.ok) throw new Error(res.statusText);

    const json = await res.json();

    // TODO: Test the responses
    testSameTypes(json, expected);
};

// This is a fairly simple test that the response and the spec's example resonses have the same types
export const testSameTypes = function (res, expected) {
    // log in case someone wants to manually inspect
    console.log(res, expected);
    for (const prop in expected) {
        expect(typeof res[prop]).toEqual(typeof expected[prop]);

        if (expected[prop] && typeof expected[prop] === 'object') {
            testSameTypes(res[prop], expected[prop]);
        }
    }
};

export const getTableId = async function (tableland, txnHash, tries = 5) {
    const table = await waitForTx(tableland, txnHash, tries);

    await expect(table).toBeDefined();
    await expect(typeof table.tableId).toEqual('string');

    return table.tableId;
};

export const getSafe = function (obj, location) {
    const keys = typeof location == 'string' ? location.split('.') : location;

    return keys.reduce(function (acc, curr) {
        if (!acc) return acc;
        return acc[curr];
    }, obj);
};

export const waitForTx = async function (tableland, txnHash, tries = 5) {
    let table = await tableland.receipt(txnHash);
    let tryy = 0
    while (!table && tryy < tries) {
        await new Promise(resolve => setTimeout(resolve, 1500 + (tries * 500)));
        table = await tableland.receipt(txnHash);
        tryy++;
    }

    if (!table) throw new Error(`could not get transaction receipt: ${txnHash}`);

    return table;
};

// The open api spec file routes are templated with single squiggle brakets {} 
// This is a simple implementation of rendering that type of template
export const renderPath = function (tmpl, data) {
    let rendered = '';
    for (let i = 0; i < tmpl.length; i++) {
        if (tmpl[i] !== '{') {
            rendered += tmpl[i];
            continue;
        }

        const open = i;
        const close = tmpl.indexOf('}');

        const val = data[tmpl.slice(open + 1, close)].toString();

        return renderPath(`${tmpl.slice(0, open)}${val}${tmpl.slice(close + 1)}`, data);
    }

    return rendered;
};

export const loadSpecTestData = function (specPath) {

    // Let's consume the open api spec and map it to fetch requests that we can test the spec's responses against
    const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
    const routes = [];
    const tests = [];

    for (const routeTemplate in spec.paths) {
        // NOTE: the template and data variable names are defined in the spec
        const route = renderPath(routeTemplate, {
            chainID: 31337,
            id: 1,
            ethAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' // Hardhat #1
        });

        const methods = Object.keys(spec.paths[routeTemplate]).reduce((acc, cur) => {
            const method = {
                name: cur
            };
            if (cur === 'post') {
                // TODO: this is obviously a hack, we could map all the content types to an example request,
                //       but currently there's only application/json so I am just grabbing that one.
                method.examples = spec.paths[routeTemplate][cur].requestBody.content['application/json'].examples

                const exampleResponses = getSafe(spec, [
                    'paths',
                    routeTemplate,
                    cur,
                    'responses',
                    '200',
                    'content',
                    'application/json',
                    'examples'
                ]);

                for (const resExampleName in exampleResponses) {
                    const resExample = exampleResponses[resExampleName].value;

                    method.examples[resExampleName].response = resExample;
                }
            } else {
                // TODO: put GET requests' responses on the method object
                const exampleResponse = getSafe(spec, [
                    'paths',
                    routeTemplate,
                    cur,
                    'responses',
                    '200',
                    'content',
                    'application/json',
                    'schema',
                    'items',
                    'example'
                ]);

                method.examples = [{response: exampleResponse}];
            }

            acc.push(method);
            return acc;
        }, []);

        routes.push({ route, routeTemplate, methods });
    }

    // Now we have the routes methods and what the request body's (if any) look like
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i].route;
        const routeTemplate = routes[i].routeTemplate;

        for (let j = 0; j < routes[i].methods.length; j++) {
            const method = routes[i].methods[j];
            const examples = method.examples ? Object.keys(method.examples) : [''];

            for (let k = 0; k < examples.length; k++) {
                const exampleName = examples[k];
                const body = method.examples ? method.examples[exampleName].value : '';
                const response = method.examples ? method.examples[exampleName].response : {};

                tests.push({
                    name: `API spec file: ${routeTemplate} ${method.name} ${exampleName}`,
                    host: HOST,
                    route,
                    methodName: method.name,
                    body,
                    response: response
                });
            }
        }
    }

    return tests;
}
