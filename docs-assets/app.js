(function () {
  const TOKEN_KEY = "web-saude-docs-token";
  const USER_KEY = "web-saude-docs-user";
  const HTTP = ["get", "post", "put", "patch", "delete"];

  const toastEl = document.querySelector(".toast");
  const catalog = document.getElementById("catalog");
  const sessionCard = document.getElementById("session-card");
  const searchInput = document.getElementById("search");
  const routeCount = document.getElementById("route-count");

  let spec = null;
  let groups = [];

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSession(accessToken, profile) {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    else localStorage.removeItem(TOKEN_KEY);
    if (profile) localStorage.setItem(USER_KEY, JSON.stringify(profile));
    else localStorage.removeItem(USER_KEY);
    renderSession();
  }

  function resolve(schema) {
    if (!schema) return {};
    if (schema.$ref) {
      const name = schema.$ref.split("/").pop();
      return spec.components?.schemas?.[name] || {};
    }
    if (schema.allOf) {
      return schema.allOf.map(resolve).reduce((acc, part) => Object.assign(acc, part), {});
    }
    return schema;
  }

  function exampleFrom(schema) {
    const resolved = resolve(schema);
    if (resolved.example !== undefined) return resolved.example;
    if (resolved.properties) {
      const out = {};
      for (const [key, value] of Object.entries(resolved.properties)) {
        const prop = resolve(value);
        if (prop.example !== undefined) out[key] = prop.example;
        else if (prop.enum) out[key] = prop.enum[0];
        else if (prop.type === "number" || prop.type === "integer") out[key] = 0;
        else if (prop.type === "boolean") out[key] = false;
        else if (prop.type === "array") out[key] = [];
        else out[key] = "";
      }
      return out;
    }
    return {};
  }

  function jsonBodySchema(op) {
    return op.requestBody?.content?.["application/json"]?.schema;
  }

  function needsAuth(op) {
    return Boolean(op.security && op.security.length);
  }

  function buildGroups() {
    const byTag = new Map();
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [method, op] of Object.entries(methods)) {
        if (!HTTP.includes(method) || !op) continue;
        const tag = (op.tags && op.tags[0]) || "Outros";
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push({ method, path, op, id: method + path });
      }
    }
    const order = (spec.tags || []).map((tag) => tag.name);
    groups = order
      .map((name) => ({
        name,
        description: (spec.tags || []).find((tag) => tag.name === name)?.description || "",
        items: byTag.get(name) || [],
      }))
      .filter((group) => group.items.length);
  }

  function matches(item, query) {
    if (!query) return true;
    const blob = [item.method, item.path, item.op.summary, ...(item.op.tags || [])]
      .join(" ")
      .toLowerCase();
    return blob.includes(query);
  }

  function renderSession() {
    const current = user();
    if (current) {
      sessionCard.innerHTML =
        '<h3>Sessão</h3>' +
        '<div class="session-user">' +
        "<strong>" + esc(current.name || current.email) + "</strong>" +
        '<span class="chip chip-ok">' + esc(current.role || "autenticado") + "</span>" +
        "</div>" +
        '<button class="btn btn-ghost btn-lg" type="button" id="logout">Sair</button>' +
        '<p class="sub">O token entra sozinho nas rotas com cadeado.</p>' +
        navHtml();
      document.getElementById("logout").onclick = function () {
        setSession("", null);
        toast("Sessão encerrada.");
      };
      return;
    }

    sessionCard.innerHTML =
      "<h3>Entrar</h3>" +
      '<p class="sub">Mesma conta do Web Saúde. Sem colar JWT.</p>' +
      '<form id="login-form" class="params">' +
      '<label class="field"><span>E-mail</span><input class="input" name="email" type="email" placeholder="seu@email.com" required></label>' +
      '<label class="field"><span>Senha</span><input class="input" name="password" type="password" required></label>' +
      '<button class="btn btn-primary btn-lg" type="submit">Entrar</button>' +
      "</form>" +
      navHtml();

    document.getElementById("login-form").onsubmit = async function (event) {
      event.preventDefault();
      const body = {
        email: this.email.value,
        password: this.password.value,
      };
      try {
        const res = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
        toast(
            Array.isArray(data.message)
              ? data.message[0]
              : data.message || "Não foi possível entrar.",
          );
          return;
        }
        setSession(data.accessToken, data.user || { email: body.email, role: "autenticado" });
        toast("Sessão iniciada.");
      } catch {
        toast("Falha de rede ao entrar.");
      }
    };
  }

  function navHtml() {
    return (
      '<nav class="side-nav">' +
      groups
        .map(function (group) {
          return '<a href="#g-' + encodeURIComponent(group.name) + '">' + esc(group.name) + "</a>";
        })
        .join("") +
      "</nav>"
    );
  }

  function paramFields(item) {
    const params = item.op.parameters || [];
    return params
      .map(function (param) {
        const name = item.id + "-" + param.name;
        return (
          '<label class="field"><span>' +
          esc(param.name) +
          (param.required ? " *" : "") +
          " · " +
          esc(param.in) +
          "</span><input class='input' data-in='" +
          esc(param.in) +
          "' data-name='" +
          esc(param.name) +
          "' id='" +
          esc(name) +
          "' placeholder='" +
          esc(param.name) +
          "'></label>"
        );
      })
      .join("");
  }

  function bodyField(item) {
    const schema = jsonBodySchema(item.op);
    if (!schema) return "";
    const example = JSON.stringify(exampleFrom(schema), null, 2);
    return (
      '<label class="field"><span>Corpo JSON</span>' +
      '<textarea class="textarea" data-body>' +
      esc(example) +
      "</textarea></label>"
    );
  }

  function routeCard(item) {
    const auth = needsAuth(item.op)
      ? '<span class="chip">com login</span>'
      : '<span class="chip">pública</span>';
    return (
      '<article class="card route" data-id="' +
      esc(item.id) +
      '">' +
      '<button class="route-head" type="button">' +
      '<span class="method ' +
      item.method +
      '">' +
      item.method.toUpperCase() +
      "</span>" +
      "<div><code>" +
      esc(item.path) +
      "</code><small>" +
      esc(item.op.summary || "") +
      "</small></div>" +
      auth +
      "</button>" +
      '<div class="route-body" hidden>' +
      '<div class="params">' +
      paramFields(item) +
      bodyField(item) +
      "</div>" +
      '<button class="btn btn-primary" type="button" data-send>Enviar</button>' +
      '<pre class="response" data-out>A resposta aparece aqui.</pre>' +
      "</div></article>"
    );
  }

  function renderCatalog() {
    const query = (searchInput.value || "").trim().toLowerCase();
    let total = 0;
    catalog.innerHTML = groups
      .map(function (group) {
        const items = group.items.filter(function (item) {
          return matches(item, query);
        });
        total += items.length;
        if (!items.length) return "";
        return (
          '<section class="group" id="g-' +
          encodeURIComponent(group.name) +
          '">' +
          '<div class="group-head"><h3>' +
          esc(group.name) +
          "</h3><p>" +
          esc(group.description) +
          "</p></div>" +
          items.map(routeCard).join("") +
          "</section>"
        );
      })
      .join("");
    routeCount.textContent = total + (total === 1 ? " rota" : " rotas");
    renderSession();
  }

  function fillPath(path, params) {
    return path.replace(/\{([^}]+)\}/g, function (_, name) {
      return encodeURIComponent(params[name] || "");
    });
  }

  catalog.addEventListener("click", async function (event) {
    const head = event.target.closest(".route-head");
    if (head) {
      const body = head.parentElement.querySelector(".route-body");
      body.hidden = !body.hidden;
      return;
    }

    const send = event.target.closest("[data-send]");
    if (!send) return;

    const card = send.closest(".route");
    const item = groups
      .flatMap(function (group) {
        return group.items;
      })
      .find(function (entry) {
        return entry.id === card.dataset.id;
      });
    if (!item) return;

    const pathParams = {};
    const query = new URLSearchParams();
    card.querySelectorAll("[data-name]").forEach(function (input) {
      if (!input.value) return;
      if (input.dataset.in === "path") pathParams[input.dataset.name] = input.value;
      if (input.dataset.in === "query") query.set(input.dataset.name, input.value);
    });

    let url = fillPath(item.path, pathParams);
    const qs = query.toString();
    if (qs) url += "?" + qs;

    const headers = { Accept: "application/json" };
    if (needsAuth(item.op) && token()) {
      headers.Authorization = "Bearer " + token();
    }

    const init = { method: item.method.toUpperCase(), headers };
    const bodyEl = card.querySelector("[data-body]");
    if (bodyEl && item.method !== "get") {
      headers["Content-Type"] = "application/json";
      init.body = bodyEl.value;
    }

    const out = card.querySelector("[data-out]");
    out.textContent = "Enviando…";
    out.classList.remove("is-ok", "is-err");

    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      out.textContent = res.status + " " + res.statusText + "\n" + pretty;
      out.classList.add(res.ok ? "is-ok" : "is-err");

      if (item.path === "/auth/login" && res.ok) {
        const data = JSON.parse(text);
        setSession(data.accessToken, data.user);
        toast("Sessão atualizada pelo login da rota.");
      }
    } catch (err) {
      out.textContent = String(err);
      out.classList.add("is-err");
    }
  });

  searchInput.addEventListener("input", renderCatalog);
  document.getElementById("search-form").addEventListener("submit", function (event) {
    event.preventDefault();
  });

  fetch("/docs-json")
    .then(function (res) {
      return res.json();
    })
    .then(function (doc) {
      spec = doc;
      buildGroups();
      renderCatalog();
    })
    .catch(function () {
      catalog.innerHTML = '<p class="help">Não foi possível carregar as rotas.</p>';
    });
})();
