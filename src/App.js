import './App.css';
import React, {useEffect, useReducer} from 'react';
import { generateClient } from 'aws-amplify/api';
import { List, Input, Button } from 'antd';
import 'antd/dist/reset.css';
import { v4 as uuid } from 'uuid';
import { listNotes } from './graphql/queries';
import { 
  createNote as CreateNote,
  updateNote as UpdateNote,
  deleteNote as DeleteNote
} from './graphql/mutations';
import { onCreateNote } from './graphql/subscriptions';
import { Amplify } from 'aws-amplify';
import amplifyconfig from './amplifyconfiguration.json';

Amplify.configure(amplifyconfig);

const CLIENT_ID = uuid();

const client = generateClient();

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: { name: '', description: '' }
}

function reducer(state, action) {
  switch(action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes, loading: false };
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes]}
    case 'RESET_FORM':
      return { ...state, form: initialState.form }
    case 'SET_INPUT':
      return { ...state, form: { ...state.form, [action.name]: action.value } }
    case 'ERROR':
      return { ...state, loading: false, error: true };
    default:
      return { ...state };
  }
};

const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchNotes = async() => {
    try {
      const notesData = await client.graphql({
        query: listNotes
      });
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR' });
    }
  };

const createNote = async() => {
  const { form } = state //destructuring - form element out of state
    if (!form.name || !form.description) {
        return alert('please enter a name and description')
    }
  const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() }
  dispatch({ type: 'ADD_NOTE', note });
  dispatch({ type: 'RESET_FORM' });
  try {
    await client.graphql({
      query: CreateNote,
      variables: { input: note }
    })
    console.log('successfully created note!')
  } catch (err) {
    console.error("error: ", err)
  }
};

const deleteNote = async({ id }) => {
  const index = state.notes.findIndex(n => n.id === id)
  const notes = [
    ...state.notes.slice(0, index), 
    ...state.notes.slice(index + 1)];
  dispatch({ type: 'SET_NOTES', notes })
  try {
    await client.graphql({
      query: DeleteNote,
      variables: { input: { id } }
    })
    console.log('successfully deleted note!')
    } catch (err) {
      console.error(err)
  }
};

const updateNote = async(note) => {
  const index = state.notes.findIndex(n => n.id === note.id)
  const notes = [...state.notes]
  notes[index].completed = !note.completed
  dispatch({ type: 'SET_NOTES', notes})
  try {
    await client.graphql({
      query: UpdateNote,
      variables: { input: { id: note.id, completed: notes[index].completed } }
    })
    console.log('note successfully updated!')
  } catch (err) {
    console.error(err)
  }
};

const onChange = (e) => {
  dispatch({ type: 'SET_INPUT', name: e.target.name, value: e.target.value })
};

useEffect(() => {
  fetchNotes()
  const subscription = client.graphql({
    query: onCreateNote
  })
    .subscribe({
      next: noteData => {
        const note = noteData.data.onCreateNote
        if (CLIENT_ID === note.clientId) return
        dispatch({ type: 'ADD_NOTE', note })
      }
    })
    return () => subscription.unsubscribe();
}, []);

const styles = {
  container: {padding: 20},
  input: { marginBottom: 10 },
  item: { textAlign: 'left' },
  p: { color: '#1890ff' }
};

function renderItem(item) {
  return (
    <List.Item 
      actions={[
        <p style={styles.p} onClick={() => updateNote(item)}> 
          {item.completed 
            ? 
          <label 
            className="labelForDoneCheckbox"
          >
            Done     
          <input 
            className="doneCheckbox"
            type="checkbox" 
            name="done checkbox" 
            defaultChecked={true} 
          />
          </label> 
            : 
          <label 
            className="labelForDoneCheckbox">
            Done     
          <input 
            className="doneCheckbox"
            type="checkbox" 
            name="done checkbox" 
            defaultChecked={false} />
          </label>}
          </p>,
        <Button type="primary" onClick={() => deleteNote(item)}>
          Delete
        </Button>
      ]}
    >
      <List.Item.Meta
        title={item.name}
        description={item.description}
      />
    </List.Item>
  )
};

  return (
    <div style={styles.container}>
      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder="Note Name"
        name='name'
        style={styles.input}
      />
      <Input
        onChange={onChange}
        value={state.form.description}
        placeholder="Note description"
        name='description'
        style={styles.input}
      />
      <Button
        onClick={createNote}
        type="primary"
      >Create Note</Button>
      <List
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />

    </div>
  );
}

export default App;

