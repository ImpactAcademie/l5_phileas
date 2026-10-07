const list = document.querySelector('#task-list');
const emptyState = document.querySelector('#empty-state');
const emptyTitle = document.querySelector('#empty-title');
const form = document.querySelector('#add-form');
const input = document.querySelector('#task-input');
const filterButtons = [...document.querySelectorAll('.filter-button')];
const apiStatus = document.querySelector('#api-status');
const API_URL = '/todo';
let tasks = [];
let activeFilter = 'all';

async function requestTasks(path = '', options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
  if (response.status === 204) return null;
  return response.json();
}

function setApiMessage(message = '') {
  apiStatus.textContent = message;
  apiStatus.classList.toggle('is-hidden', !message);
}

function normalizeTasks(rows) {
  if (!Array.isArray(rows)) throw new Error('Le serveur a renvoyé une liste invalide.');
  return rows.map(row => ({
    id: String(row.id),
    text: String(row.tache ?? row.text ?? ''),
    completed: Boolean(row.completed)
  }));
}

async function loadTasks() {
  try {
    tasks = normalizeTasks(await requestTasks());
    setApiMessage('');
  } catch (error) {
    setApiMessage(`Impossible de charger les missions : ${error.message}. Vérifie que le serveur est démarré.`);
  }
  render();
}

function render() {
  list.replaceChildren();
  const visibleTasks = tasks.filter(task => {
    if (activeFilter === 'active') return !task.completed;
    if (activeFilter === 'completed') return task.completed;
    return true;
  });

  visibleTasks.forEach(task => {
    const item = document.createElement('li');
    item.className = `task-item${task.completed ? ' completed' : ''}`;

    const check = document.createElement('button');
    check.className = 'task-check';
    check.type = 'button';
    check.setAttribute('aria-label', task.completed ? `Marquer « ${task.text} » à faire` : `Terminer « ${task.text} »`);
    check.setAttribute('aria-pressed', String(task.completed));
    check.textContent = '✓';
    check.addEventListener('click', async () => {
      const completed = !task.completed;
      check.disabled = true;
      try {
        await requestTasks(`/${encodeURIComponent(task.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ completed })
        });
        task.completed = completed;
        setApiMessage('');
      } catch (error) {
        setApiMessage(`Impossible de mettre à jour la mission : ${error.message}.`);
      }
      render();
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const meta = document.createElement('span');
    meta.className = 'task-meta';
    meta.textContent = task.completed ? 'QUÊTE VALIDÉE' : 'QUÊTE ACTIVE';

    const remove = document.createElement('button');
    remove.className = 'task-delete';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Supprimer « ${task.text} »`);
    remove.textContent = '×';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await requestTasks(`/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
        tasks = tasks.filter(entry => entry.id !== task.id);
        setApiMessage('');
      } catch (error) {
        setApiMessage(`Impossible de supprimer la mission : ${error.message}.`);
      }
      render();
    });

    item.append(check, text, meta, remove);
    list.append(item);
  });

  const completedCount = tasks.filter(task => task.completed).length;
  const totalCount = tasks.length;
  const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  document.querySelector('#total-count').textContent = totalCount;
  document.querySelector('#done-count').textContent = completedCount;
  document.querySelector('#all-filter-count').textContent = totalCount;
  document.querySelector('#progress-label').textContent = `${percent}% XP`;
  document.querySelector('#progress-fill').style.width = `${percent}%`;
  document.querySelector('#progress-caption').textContent = totalCount && percent === 100
    ? 'Toutes les quêtes sont validées. Bien joué !'
    : 'Une mission à la fois, tu peux le faire !';

  const noTasks = visibleTasks.length === 0;
  emptyState.classList.toggle('is-hidden', !noTasks);
  list.classList.toggle('is-hidden', noTasks);
  emptyTitle.textContent = totalCount === 0 ? 'Ton journal est vide' : 'Aucune mission ici';

  filterButtons.forEach(button => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  requestTasks('', {
    method: 'POST',
    body: JSON.stringify({ tache: text, completed: false })
  }).then(row => {
    tasks.unshift({ id: String(row.id), text: String(row.tache ?? text), completed: Boolean(row.completed) });
    activeFilter = 'all';
    input.value = '';
    setApiMessage('');
    render();
    input.focus();
  }).catch(error => {
    setApiMessage(`Impossible d’ajouter la mission : ${error.message}.`);
  }).finally(() => {
    submitButton.disabled = false;
  });
});

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    render();
  });
});

document.querySelector('#clear-completed').addEventListener('click', async event => {
  const clearButton = event.currentTarget;
  const completedTasks = tasks.filter(task => task.completed);
  if (!completedTasks.length) return;
  clearButton.disabled = true;
  try {
    await Promise.all(completedTasks.map(task => requestTasks(`/${encodeURIComponent(task.id)}`, { method: 'DELETE' })));
    tasks = tasks.filter(task => !task.completed);
    setApiMessage('');
  } catch (error) {
    setApiMessage(`Impossible d’effacer toutes les missions terminées : ${error.message}.`);
    await loadTasks();
  } finally {
    clearButton.disabled = false;
    render();
  }
});

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
}).format(new Date()).toUpperCase();

loadTasks();
