#!/usr/bin/env fish

# Root of Spire docs
set BASE_URL "https://developer.spiresystems.com/docs"
set OUTDIR "./docs/spire-api"

# Create directories
mkdir -p $OUTDIR/html
mkdir -p $OUTDIR/md

echo ">>> Downloading Spire API docs..."
wget --mirror \
     --page-requisites \
     --convert-links \
     --adjust-extension \
     --no-parent \
     --directory-prefix=$OUTDIR/html \
     $BASE_URL

echo ">>> Converting HTML to Markdown with clean names and folders..."
for f in (find $OUTDIR/html -name "*.html")
    # Relative path from html root
    set relpath (string replace $OUTDIR/html/ '' $f)
    set dirpath (dirname $relpath)

    # Create corresponding folder in md
    mkdir -p $OUTDIR/md/$dirpath

    # Clean filename: remove .html and trailing -digits
    set rawname (basename $f .html)
    set cleanname (echo $rawname | sed 's/-[0-9]\+$//')

    # Convert HTML -> Markdown
    pandoc -f html -t gfm $f -o $OUTDIR/md/$dirpath/$cleanname.md
end

echo ">>> Building structured index..."
set INDEX_FILE "$OUTDIR/index.md"
echo "# Spire API Reference" > $INDEX_FILE
echo "" >> $INDEX_FILE
echo "Auto-generated from $BASE_URL" >> $INDEX_FILE
echo "" >> $INDEX_FILE

# Iterate through directories
for dir in (find $OUTDIR/md -type d | sort)
    set reldir (string replace $OUTDIR/md/ '' $dir)
    if test "$reldir" != ""
        echo "## $reldir" >> $INDEX_FILE
        echo "" >> $INDEX_FILE
    end

    # List Markdown files in this folder
    for f in (find $dir -maxdepth 1 -name "*.md" | sort)
        set fname (basename $f .md)

        # Find corresponding HTML for title extraction
        set htmlf (string replace $OUTDIR/md/ $OUTDIR/html/ $f | string replace '.md' '.html')

        if test -f $htmlf
            set title (grep -o '<title>.*</title>' $htmlf | sed 's/<\/\?title>//g' | head -n 1 | string trim)
        else
            set title $fname
        end

        if test -z "$title"
            set title $fname
        end

        # Write link to index
        if test "$reldir" = ""
            echo "- [$title](md/$fname.md)" >> $INDEX_FILE
        else
            echo "- [$title]($reldir/$fname.md)" >> $INDEX_FILE
        end
    end

    echo "" >> $INDEX_FILE
end

echo ">>> Done!"
echo "Markdown docs in $OUTDIR/md"
echo "Structured index created at $INDEX_FILE"
