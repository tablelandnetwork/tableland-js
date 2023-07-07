import fs from "fs";
import { expect } from "chai";
import yaml from "js-yaml";

export const HOST = "http://localhost:8080";

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

    expect(typeof headerVal).not.to.eql("undefined");
    expect(typeof headerVal).to.eql(expected[headerName].schema.type);
  }
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
    console.log(prop);
    expect(typeof res[prop]).to.eql(typeof expected[prop]);

    if (expected[prop] && typeof expected[prop] === "object") {
      testSameTypes(res[prop], expected[prop]);
    }
  }
};

export const getSafe = function (obj, location) {
  const keys = typeof location === "string" ? location.split(".") : location;

  return keys.reduce(function (acc, curr) {
    if (!acc) return acc;
    return acc[curr];
  }, obj);
};

// The open api spec file routes are templated with single squiggle brakets {}
// This is a simple implementation of rendering that type of template
export const renderPath = function (tmpl, data) {
  let rendered = "";
  for (let i = 0; i < tmpl.length; i++) {
    if (tmpl[i] !== "{") {
      rendered += tmpl[i];
      continue;
    }

    const open = i;
    const close = tmpl.indexOf("}");

    const datum = data[tmpl.slice(open + 1, close)];
    if (!datum) throw new Error("Failed to render open api spec for " + tmpl);
    const val = datum.toString();

    return renderPath(
      `${tmpl.slice(0, open)}${val}${tmpl.slice(close + 1)}`,
      data
    );
  }

  return rendered;
};

export const loadSpecTestData = function (specPath) {
  // Let's consume the open api spec and map it to fetch requests that we can test the spec's responses against
  const spec = yaml.load(fs.readFileSync(specPath, "utf8"));
  const routes = [];
  const tests = [];

  for (const routeTemplate in spec.paths) {
    // NOTE: the template and data variable names are defined in the spec
    const route = (function (routeTemplate) {
      // capture `routeTemplate` from outer scope
      return (renderData) => renderPath(routeTemplate, renderData);
    })(routeTemplate.toString());

    const methods = Object.keys(spec.paths[routeTemplate]).reduce(function (
      acc,
      cur
    ) {
      const method = { name: cur };
      if (cur === "post") {
        // NOTE: We could map all the content types to an example request, but the http server only
        //       ever responses with application/json so I am just grabbing that one.
        method.examples =
          spec.paths[routeTemplate][cur].requestBody.content[
            "application/json"
          ].examples;

        const resHeaders = getSafe(spec, [
          "paths",
          routeTemplate,
          cur,
          "responses",
          "200",
          "headers",
        ]);

        const exampleResponses = getSafe(spec, [
          "paths",
          routeTemplate,
          cur,
          "responses",
          // NOTE: We could be looping through all status codes and testing each, but that would mean
          //       the spec would need some means to construct a request that results in a > 400 code
          "200",
          "content",
          "application/json",
          "examples",
        ]);

        for (const resExampleName in exampleResponses) {
          const resExample = exampleResponses[resExampleName].value;

          method.examples[resExampleName].response = resExample;
          method.examples[resExampleName].headers = resHeaders;
        }
      } else {
        // put GET requests" responses on the method object
        const schema = getSafe(spec, [
          "paths",
          routeTemplate,
          cur,
          "responses",
          "200",
          "content",
          "application/json",
          "schema",
        ]);

        // get example for array and object response types
        const exampleResponse = getSafe(schema, ["example"]);

        method.examples = [{ response: exampleResponse }];
      }

      acc.push(method);
      return acc;
    },
    []);

    routes.push({ route, routeTemplate, methods });
  }

  // Now we have the routes methods and what the request body's (if any) look like
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i].route;
    const routeTemplate = routes[i].routeTemplate;

    for (let j = 0; j < routes[i].methods.length; j++) {
      const method = routes[i].methods[j];
      const examples = method.examples ? Object.keys(method.examples) : [""];

      for (let k = 0; k < examples.length; k++) {
        const exampleName = examples[k];
        const body = method.examples ? method.examples[exampleName].value : "";
        const response = method.examples
          ? method.examples[exampleName].response
          : {};
        const headers = method.examples
          ? method.examples[exampleName].headers
          : {};

        // TODO: The spec includes headers and we might as well test them
        tests.push({
          name: `API spec file: ${routeTemplate} ${method.name} ${exampleName}`,
          host: HOST,
          methodName: method.name,
          route,
          body,
          response,
          headers,
        });
      }
    }
  }

  return tests;
};
