const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser');

const { Entry } = require('./db/entry')

const port = 4000

app.use(cors())
app.use(bodyParser.json());

const contentfulExport = require('contentful-export')
const contentfulImport = require('contentful-import')

const importContent = ({ entryId, spaceId, environmentId, managementToken }) => {

    let data = require(`./exports/content-${entryId}.json`);
    data = JSON.stringify(data).replace(/"da"/g, '"sv"')
                               .replace(/"en-US"/g, '"sv"')

    const content = JSON.parse(data)

    return contentfulImport({
        spaceId,
        environmentId,
        managementToken,
        content,
        skipContentPublishing: true,
        skipEditorInterfaces: false,
    })
}

const getLinkedEntryIds = (fields) => {
    const linkedEntryIds = []
    // Navigate each key of fields and look for id
    for (const key of Object.keys(fields)) {
        let daKey;

        // Check if da key is available
        if ('da' in fields[key] && !!(daKey = fields[key].da)) {
            if (typeof daKey === 'object' && 'sys' in daKey) {
                linkedEntryIds.push(daKey.sys.id)
            }

            if (Array.isArray(daKey)) {
                daKey.forEach(item => {
                    if ('sys' in item) {
                        linkedEntryIds.push(item.sys.id)
                    }
                })
            }
        }
    }

    return linkedEntryIds

}

const exportEntry = async (entryId, spaceId, environmentId, managementToken) => {
    // TODO: check if entry was already imported

    const result = await contentfulExport({
        spaceId,
        managementToken,
        environmentId,
        exportDir: 'exports',
        contentFile: `content-${entryId}.json`,
        contentOnly: true,
        includeDrafts: true,
        skipWebhooks: true,
        skipEditorInterfaces: true,
        useVerboseRenderer: true,
        queryEntries: [`sys.id[in]=${entryId}`]
    })

    return result.entries.length > 0
        ? getLinkedEntryIds(result.entries[0].fields)
        : []
}

const exportContent = async ({ entryId, spaceId, environmentId, managementToken }) => {
    let exportedIds = [entryId]

    const runExportChildrenExport = async (linkedEntryIds) => {
        let childEntryIds = []

        // Import each entry
        for (const id of linkedEntryIds) {
            // Export entries that were not not imported yet
            if (!exportedIds.includes(id)) {
                const ids = await exportEntry(id, spaceId, environmentId, managementToken)

                await Entry.create({ entryId: id, parentId: entryId })

                exportedIds =  [...new Set([id, ...exportedIds])]
                childEntryIds = [...ids, ...childEntryIds]
            }
        }

        return childEntryIds
    }

    // Get first level children entries
    let linkedEntryIds = await exportEntry(entryId, spaceId, environmentId, managementToken)

    do {
        // Export each entry
        linkedEntryIds = await runExportChildrenExport(linkedEntryIds)
        // receives ids of the children of the next level parent

    } while (linkedEntryIds.length > 0)

    return exportedIds
}

app.post('/copy-content', async (req, res) => {
    // TODO: store the copied content in database
    // TODO: check if a content was already imported
    // TODO: return detailed response
    // TODO: create progress bar

    const exportedIds = await exportContent(req.body.export)


    // Store exported item
    /*
    for (const id of exportedIds) {
        await Entry.create({
            entryId: id,
            parentId: req.body.export.entryId,
        })
    }

     */

    for (const id of exportedIds) {
        await importContent({ ...req.body.import, entryId: id })
        await Entry.update({  imported: true }, { where: { entryId: id } })
    }

    await Entry.update({  batchDone: true }, { where: { parentId: req.body.import.entryId } })

    res.send(true)

})

app.get('/import-update/:entryId', async (req, res) => {
    const entries = await Entry.findAll({
        where: {
            parentId: req.params.entryId,
            batchDone: false
        },
    })

    const total = entries.length
    const processed = entries.reduce((sum, entry) => sum + (+entry.imported), 0)

    res.send({ total, processed })
})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})