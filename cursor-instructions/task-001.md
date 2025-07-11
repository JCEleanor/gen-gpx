# Task type
Refactor

# Description
Currently, the project requires users to upload a JSON file to convert it to a GPX file. The new feature should allow users to paste a YAMAP activity link and convert it to a GPX file.

# Implementation Details

1. Change the upload area to accept a YAMAP activity link. It should be a text input field with a placeholder "Please paste a YAMAP activity link here", and please let user know the expected link should be like "https://yamap.com/activities/39755763".

2. wehn user hits convert button, use the activity id, (in the above example, it is 39755763) to fetch the activity data from this endpoint: `https://api.yamap.com/v4/activities/{activity_id}/activity_regularized_track`.

3. The response will be a JSON object like @json-files/日光白根-2.json.

4. Use @index.js as a reference to convert the JSON object to a GPX file.
