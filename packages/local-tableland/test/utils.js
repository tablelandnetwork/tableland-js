import fs from 'fs';
import yaml from 'js-yaml';
import { connect } from '@tableland/sdk';

export const HOST = 'http://localhost:8080';

export const getTableland = async function (signer, options = {}) {
    return await connect({
        signer: signer,
        chain: 'custom',
        // default contract address on hardhat
        contract: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        host: HOST,
        ...options
    });
};

export const testRpcResponse = async function (res, expected) {
    if (!res.ok) throw new Error(res.statusText);

    const json = await res.json();

    if (json.error) throw new Error(json.error.message);
    if (!json.result) throw new Error("Malformed RPC response");

    // Test that responses have the schema for the body matching the spec
    testSameTypes(json, expected.response);

    // Test that the responses have headers matching the spec
    testHeaders(res.headers, expected.headers);
};

const testHeaders = function (headers, expected) {
    for (const headerName in expected) {
        const headerVal = headers.get(headerName);

        // TODO: use a lib like debug to enable logging based on a --verbose flag or similar
        // log in case someone wants to manually inspect
        console.log(`Header- ${headerName}: ${headerVal}`);

        expect(typeof headerVal).not.toEqual('undefined');
        expect(typeof headerVal).toEqual(expected[headerName].schema.type);
    }
}

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

export const getSafe = function (obj, location) {
    const keys = typeof location == 'string' ? location.split('.') : location;

    return keys.reduce(function (acc, curr) {
        if (!acc) return acc;
        return acc[curr];
    }, obj);
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

        const datum = data[tmpl.slice(open + 1, close)];
        if (!datum) throw new Error('Failed to render open api spec for ' + tmpl)
        const val = datum.toString();

        return renderPath(`${tmpl.slice(0, open)}${val}${tmpl.slice(close + 1)}`, data);
    }

    return rendered;
};

export const loadSpecTestData = function (specPath, renderData) {

    // Let's consume the open api spec and map it to fetch requests that we can test the spec's responses against
    const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
    const routes = [];
    const tests = [];

    for (const routeTemplate in spec.paths) {
        // NOTE: the template and data variable names are defined in the spec
        const route = renderPath(routeTemplate, renderData);

        const methods = Object.keys(spec.paths[routeTemplate]).reduce((acc, cur) => {
            const method = {
                name: cur
            };
            if (cur === 'post') {
                // NOTE: We could map all the content types to an example request, but the http server only
                //       ever responses with application/json so I am just grabbing that one.
                method.examples = spec.paths[routeTemplate][cur].requestBody.content['application/json'].examples

                const resHeaders = getSafe(spec, [
                    'paths',
                    routeTemplate,
                    cur,
                    'responses',
                    '200',
                    'headers'
                ]);

                const exampleResponses = getSafe(spec, [
                    'paths',
                    routeTemplate,
                    cur,
                    'responses',
                    // NOTE: We could be looping through all status codes and testing each, but that would mean
                    //       the spec would need some means to construct a request that results in a > 400 code
                    '200',
                    'content',
                    'application/json',
                    'examples'
                ]);

                for (const resExampleName in exampleResponses) {
                    const resExample = exampleResponses[resExampleName].value;

                    method.examples[resExampleName].response = resExample;
                    method.examples[resExampleName].headers = resHeaders;
                }
            } else {
                // put GET requests' responses on the method object
                const schema = getSafe(spec, [
                    'paths',
                    routeTemplate,
                    cur,
                    'responses',
                    '200',
                    'content',
                    'application/json',
                    'schema'
                ]);

                // get example for array and object response types
                const exampleResponse = schema?.type === 'array' ? getSafe(schema, [
                    'items',
                    'example'
                ]) : getSafe(schema, [
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
                const headers = method.examples ? method.examples[exampleName].headers : {};

                // TODO: The spec includes headers and we might as well test them
                tests.push({
                    name: `API spec file: ${routeTemplate} ${method.name} ${exampleName}`,
                    host: HOST,
                    methodName: method.name,
                    route,
                    body,
                    response,
                    headers
                });
            }
        }
    }

    return tests;
};

export const getAccounts = function () {
    return [
        getWallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
        getWallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'),
        getWallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'),
        getWallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'),
        getWallet('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'),
        getWallet('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'),
        getWallet('0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e'),
        getWallet('0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'),
        getWallet('0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97'),
        getWallet('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6'),
        getWallet('0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897'),
        getWallet('0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82'),
        getWallet('0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1'),
        getWallet('0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd'),
        getWallet('0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa'),
        getWallet('0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61'),
        getWallet('0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0'),
        getWallet('0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd'),
        getWallet('0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0'),
        getWallet('0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e')
    ];
};

const getWallet = function (pk) {
    const wallet = new Wallet(pk);
    const provider = new providers.JsonRpcProvider('http://localhost:8545');
    const signer = wallet.connect(provider);

    return signer;
}
